import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nakama Photographie",
  description: "Portfolio photo — De l'intime à l'infini.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
