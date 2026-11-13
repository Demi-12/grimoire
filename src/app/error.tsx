"use client";

import { CrashScreen } from "@/components/crash-screen";

/** Catches rendering errors below the root layout (the whole toolkit) and reports them. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="gate-shell text-ink"><CrashScreen error={error} reset={reset} /></div>;
}
