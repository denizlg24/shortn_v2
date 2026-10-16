import type { Locale } from "@shortn/core";
import { readFileSync } from "node:fs";
const font = readFileSync(
  new URL("./assets/geist-latin-wght-normal.woff2", import.meta.url),
).toString("base64");
const mark = readFileSync(
  new URL("./assets/shortn-mark.svg", import.meta.url),
  "utf8",
);
const copy = {
  en: {
    title: "Opening your app",
    body: "If the app doesn’t open, choose how to continue.",
    app: "Open app",
    web: "Continue on the web",
    store: "Get the app",
    nojs: "Choose an option to continue.",
  },
  es: {
    title: "Abriendo la aplicación",
    body: "Si la aplicación no se abre, elige cómo continuar.",
    app: "Abrir aplicación",
    web: "Continuar en la web",
    store: "Obtener la aplicación",
    nojs: "Elige una opción para continuar.",
  },
  pt: {
    title: "A abrir a aplicação",
    body: "Se a aplicação não abrir, escolhe como continuar.",
    app: "Abrir aplicação",
    web: "Continuar na web",
    store: "Obter a aplicação",
    nojs: "Escolhe uma opção para continuar.",
  },
};
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
export function deepLinkPage(
  app: string,
  fallback: string,
  locale: Locale,
  store = false,
) {
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const text = copy[locale];
  return {
    csp: `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; font-src data:; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`,
    html: `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${text.title} · Shortn</title><style>
@font-face{font-family:"Geist Variable";font-style:normal;font-weight:100 900;font-display:swap;src:url(data:font/woff2;base64,${font}) format("woff2")}
:root{color-scheme:light dark;--bg:oklch(1 0 0);--fg:oklch(.208 .042 265.755);--muted:oklch(.46 .03 265);--hover:oklch(.94 .01 265)}
@media(prefers-color-scheme:dark){:root{--bg:oklch(.155 .03 265);--fg:oklch(.975 .004 265);--muted:oklch(.74 .025 265);--hover:oklch(.24 .03 265)}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font-family:"Geist Variable",ui-sans-serif,system-ui,sans-serif;line-height:1.5}
main{width:100%;max-width:472px;margin:0 auto;padding:max(2.5rem,12vh) 16px 64px}.brand{display:flex;align-items:center;gap:10px;margin-bottom:40px;font-size:18px;font-weight:600;letter-spacing:-.01em}.brand svg{flex-shrink:0}
h1{margin:0 0 12px;font-size:28px;line-height:1.25;font-weight:600;letter-spacing:-.025em;text-wrap:balance}p{margin:0;font-size:16px;color:var(--muted)}nav{display:flex;flex-direction:column;gap:12px;margin-top:32px}a{display:flex;align-items:center;justify-content:center;min-height:48px;padding:12px 16px;border-radius:8px;color:var(--fg);font-size:16px;font-weight:500;text-decoration:none;text-underline-offset:4px}a:hover{background:var(--hover)}#open-app{background:var(--fg);color:var(--bg)}#open-app:hover{opacity:.85}a:focus-visible{outline:2px solid var(--fg);outline-offset:4px}noscript p{margin-top:24px}::selection{background:var(--fg);color:var(--bg)}
</style></head><body><main><div class="brand">${mark}<span>Shortn</span></div><h1>${text.title}</h1><p>${text.body}</p><nav aria-label="${text.nojs}"><a id="open-app" href="${escape(app)}">${text.app}</a><a id="fallback" href="${escape(fallback)}">${store ? text.store : text.web}</a></nav><noscript><p>${text.nojs}</p></noscript></main><script nonce="${nonce}">
(() => {
  const app = document.getElementById('open-app');
  const fallback = document.getElementById('fallback');
  let timer;
  const cancel = () => { clearTimeout(timer); timer = undefined; };
  const arm = () => {
    cancel();
    if (document.visibilityState !== 'visible') return;
    timer = setTimeout(() => {
      if (document.visibilityState === 'visible') location.replace(fallback.href);
    }, 1800);
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancel(); });
  window.addEventListener('pagehide', cancel);
  window.addEventListener('blur', cancel);
  fallback.addEventListener('click', cancel);
  app.addEventListener('click', arm);
  if (document.visibilityState === 'visible') { arm(); try { location.href = app.href; } catch {} }
})();
</script></body></html>`,
  };
}
