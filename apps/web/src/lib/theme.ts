export type ThemePreference = "light" | "dark" | "system";

export const themeStorageKey = "theme";
const darkQuery = "(prefers-color-scheme: dark)";

export const isThemePreference = (value: unknown): value is ThemePreference =>
  value === "light" || value === "dark" || value === "system";

// Runs in <head> before first paint, then keeps following the OS setting and
// other tabs. Mirrors applyThemePreference below.
export const themeScript = `(()=>{try{const d=document.documentElement,m=matchMedia("${darkQuery}"),r=()=>{try{return localStorage.getItem("${themeStorageKey}")}catch{return null}},a=()=>{const t=r();d.classList.toggle("dark",t==="dark"||(t!=="light"&&m.matches))};a();m.addEventListener("change",a);addEventListener("storage",e=>{if(e.key==="${themeStorageKey}")a()})}catch{}})()`;

export function applyThemePreference(preference: ThemePreference) {
  const dark =
    preference === "dark" ||
    (preference === "system" && window.matchMedia(darkQuery).matches);
  document.documentElement.classList.toggle("dark", dark);
}
