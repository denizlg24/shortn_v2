export interface RequestGeo {
  city?: string;
  country?: string;
  countryRegion?: string;
  region?: string;
  latitude?: string;
  longitude?: string;
}

const first = (headers: Pick<Headers, "get">, ...names: string[]) => {
  for (const name of names) {
    const value = headers.get(name)?.trim();
    if (value) return value;
  }
  return undefined;
};

// Cloudflare sends cf-ipcity percent-encoded when it has non-ASCII letters.
const decode = (value: string | undefined) => {
  if (!value) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export function requestGeo(headers: Pick<Headers, "get">): RequestGeo {
  const geo: RequestGeo = {};
  const set = (key: keyof RequestGeo, value: string | undefined) => {
    if (value) geo[key] = value;
  };
  set("city", decode(first(headers, "cf-ipcity")));
  const country = first(headers, "cf-ipcountry");
  set("country", country && country !== "XX" ? country : undefined);
  set("countryRegion", first(headers, "cf-region-code", "cf-region"));
  set("region", first(headers, "cf-region"));
  set("latitude", first(headers, "cf-iplatitude"));
  set("longitude", first(headers, "cf-iplongitude"));
  return geo;
}
