"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { client, urlFor } from "@/lib/sanity";
import { Photo } from "@/types";

const query = `*[_type == "photo" && defined(image)] | order(publishedAt desc) {
  _id, title, category, publishedAt,
  image {
    asset-> {
      _id, url,
      metadata { dimensions { width, height } }
    }
  }
}`;

/* ── Curseur personnalisé ── */
function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const pos = useRef({ x: -100, y: -100 });
  const ring = useRef({ x: -100, y: -100 });
  const raf = useRef<number | undefined>(undefined);

  useEffect(() => {
    const move = (e: MouseEvent) => { pos.current = { x: e.clientX, y: e.clientY }; };
    const hover = (e: MouseEvent) => {
      const t = (e.target as HTMLElement);
      const isHover = !!t.closest("[data-hover]");
      ringRef.current?.classList.toggle("hovering", isHover);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseover", hover);

    const animate = () => {
      ring.current.x += (pos.current.x - ring.current.x) * 0.1;
      ring.current.y += (pos.current.y - ring.current.y) * 0.1;
      if (dotRef.current) {
        dotRef.current.style.left = `${pos.current.x}px`;
        dotRef.current.style.top = `${pos.current.y}px`;
      }
      if (ringRef.current) {
        ringRef.current.style.left = `${ring.current.x}px`;
        ringRef.current.style.top = `${ring.current.y}px`;
      }
      raf.current = requestAnimationFrame(animate);
    };
    raf.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseover", hover);
      cancelAnimationFrame(raf.current!);
    };
  }, []);

  return (
    <>
      <div ref={dotRef} className="cursor-dot" />
      <div ref={ringRef} className="cursor-ring" />
    </>
  );
}

/* ── Carte photo avec apparition au scroll + parallax léger ── */
function PhotoCard({ photo, idx, onOpen }: {
  photo: Photo; idx: number; onOpen: (idx: number) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [visible, setVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const imgWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );
    if (cardRef.current) obs.observe(cardRef.current);
    return () => obs.disconnect();
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current || !imgWrapRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    imgWrapRef.current.style.transform = `scale(1.08) translate(${x * -12}px, ${y * -12}px)`;
  };

  const handleMouseLeave = () => {
    setHovered(false);
    if (imgWrapRef.current) imgWrapRef.current.style.transform = "scale(1) translate(0,0)";
  };

  return (
    <div
      ref={cardRef}
      className={`photo-card ${visible ? "in-view" : ""}`}
      style={{ transitionDelay: `${(idx % 6) * 70}ms` }}
      data-hover="true"
      onMouseEnter={() => setHovered(true)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={() => onOpen(idx)}
      role="button"
      tabIndex={0}
    >
      <div className="photo-card-image">
        <div ref={imgWrapRef} className="photo-card-image-inner">
          <Image
            src={urlFor(photo.image).width(800).url()}
            alt={photo.title}
            width={photo.image?.asset?.metadata?.dimensions?.width || 800}
            height={photo.image?.asset?.metadata?.dimensions?.height || 600}
            sizes="(max-width: 768px) 100vw, 33vw"
            style={{ width: "100%", height: "auto", display: "block" }}
          />
        </div>
      </div>
      <div className={`photo-card-overlay ${hovered ? "visible" : ""}`}>
        <span className="photo-card-category">{photo.category}</span>
        <h3 className="photo-card-title">{photo.title}</h3>
      </div>
    </div>
  );
}

/* ── Lightbox ── */
function Lightbox({ photos, index, onClose, onPrev, onNext }: {
  photos: Photo[]; index: number;
  onClose: () => void; onPrev: () => void; onNext: () => void;
}) {
  const photo = photos[index];
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "ArrowRight") onNext();
    };
    window.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", h); document.body.style.overflow = ""; };
  }, [onClose, onPrev, onNext]);

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <button className="lightbox-close" onClick={onClose}>×</button>
      <button className="lightbox-nav lightbox-prev" onClick={(e) => { e.stopPropagation(); onPrev(); }}>‹</button>
      <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
        <div className="lightbox-image-wrap">
          <Image src={urlFor(photo.image).width(1400).url()} alt={photo.title} fill sizes="90vw" style={{ objectFit: "contain" }} priority />
        </div>
        <div className="lightbox-meta">
          <span className="lightbox-category">{photo.category}</span>
          <h2 className="lightbox-title">{photo.title}</h2>
          <span className="lightbox-counter">{index + 1} / {photos.length}</span>
        </div>
      </div>
      <button className="lightbox-nav lightbox-next" onClick={(e) => { e.stopPropagation(); onNext(); }}>›</button>
    </div>
  );
}

/* ── Page principale ── */
export default function Home() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [activeCategory, setActiveCategory] = useState("Tous");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [slideIndex, setSlideIndex] = useState(0);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    client.fetch<Photo[]>(query).then((data) => {
      setPhotos(data);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (photos.length === 0) return;
    const t = setInterval(() => setSlideIndex((i) => (i + 1) % photos.length), 6000);
    return () => clearInterval(t);
  }, [photos.length]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 100);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const categories = ["Tous", ...Array.from(new Set(photos.map((p) => p.category)))];
  const filtered = activeCategory === "Tous" ? photos : photos.filter((p) => p.category === activeCategory);

  const openLightbox = useCallback((idx: number) => setLightboxIndex(idx), []);
  const closeLightbox = useCallback(() => setLightboxIndex(null), []);
  const prevPhoto = useCallback(() =>
    setLightboxIndex((i) => i !== null ? (i - 1 + filtered.length) % filtered.length : null), [filtered.length]);
  const nextPhoto = useCallback(() =>
    setLightboxIndex((i) => i !== null ? (i + 1) % filtered.length : null), [filtered.length]);

  return (
    <>
      <CustomCursor />

      {/* ── HEADER ── */}
      <header className={`site-header ${scrolled ? "scrolled" : ""}`}>
        <a href="/" className="header-logo" data-hover="true">
          <Image src="/nakama.jpg" alt="Nakama" width={42} height={42} />
        </a>
        <nav className="header-nav">
          <a href="#galerie" data-hover="true">Galerie</a>
          <a href="#contact" data-hover="true">Contact</a>
          <a href="mailto:nakamaphotography5@gmail.com" data-hover="true">Réserver</a>
        </nav>
        <span className="header-count">{photos.length} photos</span>
      </header>

      {/* ── HERO ── */}
      <section className="hero-fullscreen">
        <div className="hero-slides">
          {photos.map((photo, idx) => (
            <div key={photo._id} className={`hero-slide ${idx === slideIndex ? "active" : ""}`}>
              <Image
                src={urlFor(photo.image).width(1920).url()}
                alt={photo.title}
                fill
                sizes="100vw"
                style={{ objectFit: "cover" }}
                priority={idx === 0}
              />
            </div>
          ))}
          {photos.length === 0 && <div style={{ position: "absolute", inset: 0, background: "#111" }} />}
        </div>

        <div className="hero-overlay" />

        <div className="hero-bottom">
          <div className="hero-title-wrap">
            <p className="hero-eyebrow">Nakama Photography</p>
            <h1 className="hero-title">
              De l'intime<br />
              <strong>à l'infini.</strong>
            </h1>
          </div>
          <div className="hero-right">
            <span className="hero-slide-counter">
              {String(slideIndex + 1).padStart(2, "0")} / {String(photos.length).padStart(2, "0")}
            </span>
            <a href="#galerie" className="hero-scroll-btn" data-hover="true">
              <div className="hero-scroll-line" />
              <span>Scroll</span>
            </a>
          </div>
        </div>

        <div className="hero-dots">
          {photos.map((_, idx) => (
            <button
              key={idx}
              className={`hero-dot ${idx === slideIndex ? "active" : ""}`}
              onClick={() => setSlideIndex(idx)}
              data-hover="true"
            />
          ))}
        </div>
      </section>

      {/* ── GALERIE ── */}
      <section id="galerie" className="gallery-section">
        <div className="gallery-header">
          <span className="gallery-label">Galerie — {filtered.length} photos</span>
          <div className="filter-bar">
            {categories.map((cat) => (
              <button
                key={cat}
                className={`filter-btn ${activeCategory === cat ? "active" : ""}`}
                onClick={() => setActiveCategory(cat)}
                data-hover="true"
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="loading-grid">
            {Array.from({ length: 9 }).map((_, i) => <div key={i} className="skeleton" />)}
          </div>
        ) : (
          <div className="masonry-grid">
            {filtered.map((photo, idx) => (
              <PhotoCard key={photo._id} photo={photo} idx={idx} onOpen={openLightbox} />
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <p className="empty-state">Aucune photo dans cette catégorie.</p>
        )}
      </section>

      {/* ── FOOTER ── */}
      <footer id="contact" className="site-footer">
        <div className="footer-left">
          <div className="footer-logo">
            <Image src="/nakama.jpg" alt="Nakama" width={36} height={36} />
          </div>
          <span className="footer-name">Nakama Photography</span>
        </div>

        <div className="footer-socials">
          <a href="mailto:nakamaphotography5@gmail.com" className="social-icon" data-hover="true" aria-label="Email">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="M2 7l10 6 10-6" />
            </svg>
          </a>
          <a href="https://www.facebook.com/NakamaPhotography" target="_blank" rel="noopener noreferrer" className="social-icon" data-hover="true" aria-label="Facebook">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
            </svg>
          </a>
          <a href="https://www.tiktok.com/@nakamaphotography" target="_blank" rel="noopener noreferrer" className="social-icon" data-hover="true" aria-label="TikTok">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
            </svg>
          </a>
          <a href="https://wa.me/2250708826867" target="_blank" rel="noopener noreferrer" className="social-icon" data-hover="true" aria-label="WhatsApp">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 11.5a8.5 8.5 0 0 1-12.5 7.5L3 21l2-5.5A8.5 8.5 0 1 1 21 11.5z" />
              <path d="M8.5 9.5c0 4 3 7 7 7" />
            </svg>
          </a>
        </div>

        <p className="footer-copy">© {new Date().getFullYear()} — Tous droits réservés</p>
      </footer>

      {lightboxIndex !== null && (
        <Lightbox photos={filtered} index={lightboxIndex}
          onClose={closeLightbox} onPrev={prevPhoto} onNext={nextPhoto} />
      )}
    </>
  );
}