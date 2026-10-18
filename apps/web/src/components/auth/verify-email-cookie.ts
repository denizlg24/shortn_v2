// Carries the address from sign-up or sign-in to /verify without putting it
// in the URL (and so in history and access logs).
export const verifyEmailCookie = "shortn_verify_email";

export function rememberVerifyEmail(email: string | null) {
  const secure = window.location.protocol === "https:" ? "; secure" : "";
  document.cookie = email
    ? `${verifyEmailCookie}=${encodeURIComponent(email)}; path=/verify; max-age=1800; samesite=lax${secure}`
    : `${verifyEmailCookie}=; path=/verify; max-age=0`;
}
