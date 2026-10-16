import type { SocialPreview } from "./og";
import { applyQueryRules, chooseRuleTarget, rotationCookieName } from "./rules";
import type { Locale } from "../routing";
import type { CachedLink } from "./cached-link";
import { verifyConfirmationToken, verifyLinkAccessCookie } from "./tokens";
import type { TokenSecrets } from "./tokens";

export interface DecisionInput {
  link: CachedLink;
  key: string;
  tokenKey?: string | undefined;
  origin: string;
  locale: Locale;
  confirmationToken?: string | undefined;
  accessCookie?: string | undefined;
  secrets: TokenSecrets;
  now?: number;
  query?: URLSearchParams;
  country?: string | undefined;
  userAgent?: string | undefined;
  bot?: boolean | undefined;
  previewBot?: boolean | undefined;
  rotationCookie?: string | undefined;
  clickCount?: (() => Promise<number>) | undefined;
  rotationRandom?: (() => number) | undefined;
}

interface RedirectDecision {
  type: "redirect";
  location: string;
  status: 301 | 302;
  clearAccessCookie?: boolean;
  rotationCookie?: { name: string; value: string; maxAge: number };
  deepLink?: { fallback: string; locale: Locale; store: boolean };
  socialPreview?: { og: SocialPreview; canonical: string };
  untrackedCount?: { linkId: string; base: number };
  // Only the final hop to the destination is a recorded click.
  track?: {
    linkId: string;
    branch?: string;
    counterBase?: number;
    qr?: { id: string; publicId: string };
  };
}

export type Decision =
  | {
      type: "unavailable";
      reason: "scheduled" | "expired" | "limit";
      status: 404 | 410;
      locale: Locale;
      location?: never;
      clearAccessCookie?: never;
      track?: never;
    }
  | RedirectDecision
  | {
      type: "not_found";
      status: 404;
      locale: Locale;
      location?: never;
      clearAccessCookie?: never;
      track?: never;
    };

// Legacy's NextResponse.redirect serializes through URL: a bare origin gains a
// trailing slash and non-ASCII is percent-encoded. An unparseable destination
// throws there and ends on the not-found page.
export function serializeDestination(destination: string): string | undefined {
  try {
    return new URL(destination).toString();
  } catch {
    return undefined;
  }
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
  if (link.kind === "deleted")
    return { type: "not_found", status: 404, locale };
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
          input.tokenKey ?? key,
          input.secrets,
        )
      : false;
    if (!confirmed) return safety;
  }
  if (link.pwd) {
    const authenticate = `${origin}/authenticate/${encodeURIComponent(key)}`;
    if (!input.accessCookie)
      return { type: "redirect", status: 302, location: authenticate };
    if (
      !(await verifyLinkAccessCookie(
        input.accessCookie,
        input.tokenKey ?? key,
        input.secrets,
      ))
    )
      return {
        type: "redirect",
        status: 302,
        location: authenticate,
        clearAccessCookie: true,
      };
  }
  const now = input.now ?? Date.now();
  let reason: "scheduled" | "expired" | "limit" | undefined =
    link.rules?.activeFrom !== undefined && now < link.rules.activeFrom
      ? "scheduled"
      : link.rules?.expiresAt !== undefined && now >= link.rules.expiresAt
        ? "expired"
        : undefined;
  let counterBase = link.hits ?? 0;
  if (!reason && link.rules?.maxClicks !== undefined) {
    if (link.rules.maxClicks === 0) reason = "limit";
    else {
      if (!input.clickCount)
        throw new Error("Limited links require a click counter");
      counterBase = await input.clickCount();
      if (!Number.isSafeInteger(counterBase) || counterBase < 0)
        throw new Error("Invalid click count");
      if (counterBase >= link.rules.maxClicks) reason = "limit";
    }
  }
  if (reason) {
    if (link.rules?.expiredUrl)
      return {
        type: "redirect",
        status: 302,
        location: serializeDestination(link.rules.expiredUrl)!,
      };
    return {
      type: "unavailable",
      reason,
      status: reason === "scheduled" ? 404 : 410,
      locale,
    };
  }
  const preview = input.previewBot && link.og;
  const target = chooseRuleTarget(link.dest, link.rules, {
    ...input,
    bot: input.bot || input.previewBot,
  });
  const location = serializeDestination(target.destination);
  if (!location) return notFound;
  return {
    type: "redirect",
    status: link.rules?.permanent ? 301 : 302,
    location: applyQueryRules(location, link.rules, input.query),
    ...(preview
      ? {
          socialPreview: {
            og: preview,
            canonical: new URL(
              `/${encodeURIComponent(link.key)}`,
              origin,
            ).toString(),
          },
        }
      : {}),
    ...(target.deepFallback
      ? {
          deepLink: {
            fallback: applyQueryRules(
              target.deepFallback,
              link.rules,
              input.query,
            ),
            locale,
            store: link.rules?.deepLink?.fallback === "store",
          },
        }
      : {}),
    ...(link.untracked && link.rules?.maxClicks !== undefined
      ? { untrackedCount: { linkId: link.id, base: counterBase } }
      : {}),
    ...(target.rotationCookie && !preview
      ? {
          rotationCookie: {
            name: rotationCookieName(link.id),
            value: target.rotationCookie,
            maxAge: 3600,
          },
        }
      : {}),
    ...(link.untracked
      ? {}
      : {
          track: {
            linkId: link.id,
            ...(link.rules?.maxClicks !== undefined ? { counterBase } : {}),
            ...(target.branch ? { branch: target.branch } : {}),
            ...(link.qr ? { qr: link.qr } : {}),
          },
        }),
  };
}
