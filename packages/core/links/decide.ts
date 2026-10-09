import type { Locale } from "../routing";
import type { CachedLink } from "./cached-link";
import { verifyConfirmationToken, verifyLinkAccessCookie } from "./tokens";
import type { TokenSecrets } from "./tokens";

export interface DecisionInput {
  link: CachedLink;
  key: string;
  origin: string;
  locale: Locale;
  confirmationToken?: string | undefined;
  accessCookie?: string | undefined;
  secrets: TokenSecrets;
}

export interface Decision {
  type: "redirect";
  location: string;
  status: 301 | 302;
  clearAccessCookie?: boolean;
  // Only the final hop to the destination is a recorded click.
  track?: { linkId: string; qr?: { id: string; publicId: string } };
}

export const accessCookieName = (key: string) => `link_access_${key}`;

// Mirrors legacy app/api/get-long-url/[slug]/route.ts gate by gate.
export async function decide(input: DecisionInput): Promise<Decision> {
  const { link, key, origin, locale } = input;
  const notFound: Decision = {
    type: "redirect",
    status: 302,
    location: `${origin}/en/url-not-found`,
  };
  if (link.kind === "missing") return notFound;
  if (link.kind === "alias")
    return {
      type: "redirect",
      status: 301,
      location: `${origin}/${encodeURIComponent(link.key)}`,
    };
  const safety: Decision = {
    type: "redirect",
    status: 302,
    location: `${origin}/${locale}/safety/${encodeURIComponent(key)}`,
  };
  if (link.status === "blocked") return safety;
  if (link.status === "interstitial") {
    const confirmed = input.confirmationToken
      ? await verifyConfirmationToken(
          input.confirmationToken,
          key,
          input.secrets,
        )
      : false;
    if (!confirmed) return safety;
  }
  if (link.pwd) {
    const authenticate = `${origin}/authenticate/${encodeURIComponent(key)}`;
    if (!input.accessCookie)
      return { type: "redirect", status: 302, location: authenticate };
    if (!(await verifyLinkAccessCookie(input.accessCookie, key, input.secrets)))
      return {
        type: "redirect",
        status: 302,
        location: authenticate,
        clearAccessCookie: true,
      };
  }
  if (!link.dest) return notFound;
  return {
    type: "redirect",
    status: 302,
    location: link.dest,
    ...(link.untracked
      ? {}
      : { track: { linkId: link.id, ...(link.qr ? { qr: link.qr } : {}) } }),
  };
}
