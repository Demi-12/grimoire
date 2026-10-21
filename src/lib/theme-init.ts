/**
 * Runs in <head> before first paint so the saved theme and language are on <html> already,
 * instead of appearing after hydration. The keys and fallbacks mirror toolkit.tsx.
 */
export const THEME_INIT_SCRIPT = `(function(){var d=document.documentElement;try{var t=localStorage.getItem("grimoire.theme.v1");if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}d.dataset.theme=t;var l=localStorage.getItem("grimoire.locale.v1");if(l!=="es"&&l!=="en"){l=(navigator.language||"").toLowerCase().indexOf("es")===0?"es":"en"}d.lang=l}catch(e){}})();`;
