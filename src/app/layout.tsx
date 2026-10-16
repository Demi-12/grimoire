import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Grimoire | D&D Toolkit",
  description: "Tools for building Dungeons & Dragons characters and encounters.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
