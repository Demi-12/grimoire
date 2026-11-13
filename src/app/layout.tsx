import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { THEME_INIT_SCRIPT } from "@/lib/theme-init";
import { FeedbackProvider } from "@/components/feedback";
import "./tokens.css";
import "./globals.css";
import "./dnd-theme.css";

/**
 * Self-hosted Alegreya faces (Latin + Latin Extended subsets, OFL: see fonts/OFL.txt). Kept in the repo rather than
 * fetched by next/font/google so `next build` (CI, the Docker image, the home server) never depends on Google Fonts:
 * its responses have broken the build before.
 */
// next/font needs literal options, so each face is listed in full.
const alegreya = localFont({
  src: [
    { path: "./fonts/alegreya-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/alegreya-400-italic.woff2", weight: "400", style: "italic" },
    { path: "./fonts/alegreya-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/alegreya-500-italic.woff2", weight: "500", style: "italic" },
    { path: "./fonts/alegreya-700-normal.woff2", weight: "700", style: "normal" },
    { path: "./fonts/alegreya-700-italic.woff2", weight: "700", style: "italic" },
  ],
  variable: "--f-alegreya",
  display: "swap",
  adjustFontFallback: "Times New Roman",
});
const alegreyaSC = localFont({
  src: [
    { path: "./fonts/alegreya-sc-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/alegreya-sc-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/alegreya-sc-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--f-alegreya-sc",
  display: "swap",
  adjustFontFallback: "Times New Roman",
});
const alegreyaSans = localFont({
  src: [
    { path: "./fonts/alegreya-sans-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/alegreya-sans-400-italic.woff2", weight: "400", style: "italic" },
    { path: "./fonts/alegreya-sans-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/alegreya-sans-500-italic.woff2", weight: "500", style: "italic" },
    { path: "./fonts/alegreya-sans-700-normal.woff2", weight: "700", style: "normal" },
    { path: "./fonts/alegreya-sans-700-italic.woff2", weight: "700", style: "italic" },
  ],
  variable: "--f-alegreya-sans",
  display: "swap",
  adjustFontFallback: "Arial",
});
const alegreyaSansSC = localFont({
  src: [
    { path: "./fonts/alegreya-sans-sc-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/alegreya-sans-sc-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--f-alegreya-sans-sc",
  display: "swap",
  adjustFontFallback: "Arial",
});
const fontVars = [alegreya, alegreyaSC, alegreyaSans, alegreyaSansSC].map((f) => f.variable).join(" ");

const description = "Your Dungeons & Dragons table, bound in a single book: characters, campaigns, encounters and a live battle map.";

// The favicon comes from icon.svg, favicon.ico and apple-icon.png next to this file (Next adds the links).
export const metadata: Metadata = {
  title: "Grimoire · Your D&D table",
  description,
  applicationName: "Grimoire",
  openGraph: { type: "website", siteName: "Grimoire", title: "Grimoire · Your D&D table", description },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e6e3ef" },
    { media: "(prefers-color-scheme: dark)", color: "#110e1f" },
  ],
};

export const dynamic = "force-dynamic"; // the CSP nonce is per request, so even /_not-found must render on demand

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={fontVars} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} /></head>
      <body><FeedbackProvider>{children}</FeedbackProvider></body>
    </html>
  );
}
