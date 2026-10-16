import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Grimoire | D&D Toolkit",
  description: "Herramientas para preparar personajes y encuentros de Dungeons & Dragons.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
