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
    title: "This link is unavailable",
    body: "The link may have been removed. Ask the person who shared it for an updated link.",
  },
  es: {
    title: "Este enlace no está disponible",
    body: "Es posible que el enlace se haya eliminado. Pide un enlace actualizado a la persona que lo compartió.",
  },
  pt: {
    title: "Este link não está disponível",
    body: "O link pode ter sido removido. Peça um link atualizado à pessoa que o partilhou.",
  },
} satisfies Record<Locale, { title: string; body: string }>;

// A dependency-free counterpart to the web PublicFrame: deletion must return a
// real 404 on the requested host, even when the dashboard is unavailable.
const temporalCopy = {
  en: {
    limit: {
      title: "This link has reached its visit limit",
      body: "Ask the person who shared this link for an updated link.",
    },
    scheduled: {
      title: "This link is not active yet",
      body: "Try again after the activation time, or ask the person who shared this link for details.",
    },
    expired: {
      title: "This link has expired",
      body: "Ask the person who shared this link for an updated link.",
    },
  },
  es: {
    limit: {
      title: "Este enlace ha alcanzado su límite de visitas",
      body: "Pide un enlace actualizado a la persona que lo compartió.",
    },
    scheduled: {
      title: "Este enlace aún no está activo",
      body: "Inténtalo después de la hora de activación o consulta a la persona que compartió el enlace.",
    },
    expired: {
      title: "Este enlace ha caducado",
      body: "Pide un enlace actualizado a la persona que lo compartió.",
    },
  },
  pt: {
    limit: {
      title: "Este link atingiu o limite de visitas",
      body: "Peça um link atualizado à pessoa que o partilhou.",
    },
    scheduled: {
      title: "Este link ainda não está ativo",
      body: "Tente novamente após a hora de ativação ou contacte a pessoa que partilhou o link.",
    },
    expired: {
      title: "Este link expirou",
      body: "Peça um link atualizado à pessoa que o partilhou.",
    },
  },
} satisfies Record<
  Locale,
  Record<"scheduled" | "expired" | "limit", { title: string; body: string }>
>;

export function deletedPage(
  locale: Locale,
  reason?: "scheduled" | "expired" | "limit",
): string {
  const text = reason ? temporalCopy[locale][reason] : copy[locale];
  return `<!doctype html>
<html lang="${locale}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>${text.title} · Shortn</title>
<style>
@font-face{font-family:"Geist Variable";font-style:normal;font-weight:100 900;font-display:swap;src:url(data:font/woff2;base64,${font}) format("woff2")}
:root{color-scheme:light dark;--bg:oklch(1 0 0);--fg:oklch(.208 .042 265.755);--muted:oklch(.46 .03 265)}
@media(prefers-color-scheme:dark){:root{--bg:oklch(.155 .03 265);--fg:oklch(.975 .004 265);--muted:oklch(.74 .025 265)}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font-family:"Geist Variable","Geist",ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;line-height:1.5}
main{width:100%;max-width:472px;margin:0 auto;padding:max(2.5rem,12vh) 16px 64px}
.brand{display:flex;align-items:center;gap:10px;margin:0 0 40px;font-size:18px;font-weight:600;letter-spacing:-.01em}.brand svg{flex-shrink:0}
h1{margin:0 0 12px;font-size:28px;line-height:1.25;font-weight:600;letter-spacing:-.025em;text-wrap:balance}
p{margin:0;font-size:16px;color:var(--muted)}::selection{background:var(--fg);color:var(--bg)}
</style></head><body><main><div class="brand">${mark}<span>Shortn</span></div>
<h1>${text.title}</h1><p>${text.body}</p></main></body></html>`;
}
