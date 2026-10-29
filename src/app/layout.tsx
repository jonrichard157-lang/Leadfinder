import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OrbeLead — Encontre empresas que precisam do seu serviço",
  description:
    "Plataforma de prospecção comercial para freelancers, desenvolvedores e agências digitais. Encontre empresas locais sem website.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
