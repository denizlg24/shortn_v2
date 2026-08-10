type HeaderReader = Pick<Headers, "get">;
type HeaderSource = HeaderReader | { headers: HeaderReader };

export interface RequestGeo {
  city?: string;
  country?: string;
  flag?: string;
  countryRegion?: string;
  region?: string;
  latitude?: string;
  longitude?: string;
  postalCode?: string;
  timezone?: string;
}

export interface RequestMetadata {
  ip?: string;
  geo: RequestGeo;
  timezone?: string;
}

function sourceHeaders(source: HeaderSource): HeaderReader {
  return "headers" in source ? source.headers : source;
}

function firstHeader(
  headers: HeaderReader,
  ...names: string[]
): string | undefined {
  for (const name of names) {
    const value = headers.get(name)?.trim();
    if (value) return value;
  }
  return undefined;
}

function decodeLocation(value: string | undefined): string | undefined {
  if (!value) return undefined;

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeIp(value: string | undefined): string | undefined {
  if (!value) return undefined;

  const candidate = value.trim();
  if (
    candidate.length === 0 ||
    candidate.length > 45 ||
    (!candidate.includes(".") && !candidate.includes(":")) ||
    !/^[0-9a-f:.]+$/i.test(candidate)
  ) {
    return undefined;
  }

  return candidate;
}

function countryFlag(country: string | undefined): string | undefined {
  if (!country || !/^[A-Z]{2}$/.test(country)) return undefined;

  return String.fromCodePoint(
    ...country.split("").map((character) => 127397 + character.charCodeAt(0)),
  );
}

/**
 * Resolve the original visitor IP from the trusted reverse-proxy headers.
 * Cloudflare Tunnel is the only public ingress and reaches Caddy over loopback;
 * Cloudflare replaces this single-value header before the request reaches the
 * origin. Do not fall back to caller-controlled generic proxy headers.
 */
export function getRequestIp(source: HeaderSource): string | undefined {
  const headers = sourceHeaders(source);
  return normalizeIp(
    firstHeader(headers, "cf-connecting-ipv6", "cf-connecting-ip"),
  );
}

/**
 * Read location metadata added by Cloudflare's visitor-location Managed
 * Transform. The Vercel header fallbacks keep local and rolling deployments
 * compatible without depending on @vercel/functions.
 */
export function getRequestGeo(source: HeaderSource): RequestGeo {
  const headers = sourceHeaders(source);
  const country = firstHeader(
    headers,
    "cf-ipcountry",
    "x-vercel-ip-country",
  )?.toUpperCase();
  const region = decodeLocation(
    firstHeader(headers, "cf-region", "x-vercel-ip-country-region"),
  );
  const countryRegion = decodeLocation(
    firstHeader(
      headers,
      "cf-region-code",
      "x-vercel-ip-country-region",
      "cf-region",
    ),
  );

  return {
    city: decodeLocation(firstHeader(headers, "cf-ipcity", "x-vercel-ip-city")),
    country,
    flag: countryFlag(country),
    countryRegion,
    region,
    latitude: firstHeader(headers, "cf-iplatitude", "x-vercel-ip-latitude"),
    longitude: firstHeader(headers, "cf-iplongitude", "x-vercel-ip-longitude"),
    postalCode: firstHeader(
      headers,
      "cf-postal-code",
      "x-vercel-ip-postal-code",
    ),
    timezone: firstHeader(headers, "cf-timezone", "x-vercel-ip-timezone"),
  };
}

export function getRequestMetadata(source: HeaderSource): RequestMetadata {
  const geo = getRequestGeo(source);

  return {
    ip: getRequestIp(source),
    geo,
    timezone: geo.timezone,
  };
}
