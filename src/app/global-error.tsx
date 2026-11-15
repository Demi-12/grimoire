"use client";

import { CrashScreen } from "@/components/crash-screen";
import "./globals.css";

/** Last-resort boundary for errors in the root layout itself; it replaces <html>, so it brings its own. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="en"><body><div className="gate-shell text-ink"><CrashScreen error={error} reset={reset} /></div></body></html>;
}
