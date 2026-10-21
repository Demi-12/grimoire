import type { Metadata } from "next";
import { Alegreya, Alegreya_SC, Alegreya_Sans, Alegreya_Sans_SC } from "next/font/google";
import { THEME_INIT_SCRIPT } from "@/lib/theme-init";
import "./tokens.css";
import "./globals.css";
import "./dnd-theme.css";

const alegreya = Alegreya({ subsets: ["latin", "latin-ext"], weight: ["400", "500", "700"], style: ["normal", "italic"], variable: "--f-alegreya", display: "swap" });
const alegreyaSC = Alegreya_SC({ subsets: ["latin", "latin-ext"], weight: ["400", "500", "700"], variable: "--f-alegreya-sc", display: "swap" });
const alegreyaSans = Alegreya_Sans({ subsets: ["latin", "latin-ext"], weight: ["400", "500", "700"], style: ["normal", "italic"], variable: "--f-alegreya-sans", display: "swap" });
const alegreyaSansSC = Alegreya_Sans_SC({ subsets: ["latin", "latin-ext"], weight: ["500", "700"], variable: "--f-alegreya-sans-sc", display: "swap" });
const fontVars = [alegreya, alegreyaSC, alegreyaSans, alegreyaSansSC].map((f) => f.variable).join(" ");

export const metadata: Metadata = {
  title: "Grimoire | D&D Toolkit",
  description: "Tools for building Dungeons & Dragons characters and encounters.",
};

export const dynamic = "force-dynamic"; // the CSP nonce is per request, so even /_not-found must render on demand

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={fontVars} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} /></head>
      <body>{children}</body>
    </html>
  );
}
