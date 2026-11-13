"use client";

import { useEffect, useState } from "react";
import { reportClientError } from "@/lib/telemetry-client";

const copy = {
  en: { title: "Something went wrong", body: "The error has been logged for the site admin. Try again, or reload the page.", retry: "Try again", reload: "Reload" },
  es: { title: "Algo ha fallado", body: "El error ha quedado registrado para el admin del sitio. Vuelve a intentarlo o recarga la página.", retry: "Reintentar", reload: "Recargar" },
};

/** Shown by the error boundaries (app/error.tsx, app/global-error.tsx); reports the error once. */
export function CrashScreen({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [locale, setLocale] = useState<"en" | "es">("en");
  useEffect(() => {
    let saved: string | null = null;
    try { saved = window.localStorage.getItem("grimoire.locale.v1"); } catch { /* storage disabled */ }
    setLocale(saved === "es" || (!saved && navigator.language.toLowerCase().startsWith("es")) ? "es" : "en");
  }, []);
  useEffect(() => { reportClientError(error, { digest: error.digest }); }, [error]);
  const t = copy[locale];
  return <main className="gate-main" id="main">
    <section className="gate-card" role="alert">
      <h1>{t.title}</h1>
      <p>{t.body}</p>
      <div className="gate-actions">
        <button type="button" className="button button-primary" onClick={reset}>{t.retry}</button>
        <button type="button" className="button button-quiet" onClick={() => window.location.reload()}>{t.reload}</button>
      </div>
    </section>
  </main>;
}
