import type { Metadata, Viewport } from "next";
import { Alegreya, Alegreya_SC, Alegreya_Sans, Alegreya_Sans_SC } from "next/font/google";
import { THEME_INIT_SCRIPT } from "@/lib/theme-init";
import ErrorReporting from "@/components/error-reporting";
import "./tokens.css";
import "./globals.css";
import "./dnd-theme.css";

const alegreya = Alegreya({ subsets: ["latin", "latin-ext"], weight: ["400", "500", "700"], style: ["normal", "italic"], variable: "--f-alegreya", display: "swap" });
const alegreyaSC = Alegreya_SC({ subsets: ["latin", "latin-ext"], weight: ["400", "500", "700"], variable: "--f-alegreya-sc", display: "swap" });
const alegreyaSans = Alegreya_Sans({ subsets: ["latin", "latin-ext"], weight: ["400", "500", "700"], style: ["normal", "italic"], variable: "--f-alegreya-sans", display: "swap" });
const alegreyaSansSC = Alegreya_Sans_SC({ subsets: ["latin", "latin-ext"], weight: ["500", "700"], variable: "--f-alegreya-sans-sc", display: "swap" });
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
      <body><ErrorReporting />{children}</body>
    </html>
  );
}
