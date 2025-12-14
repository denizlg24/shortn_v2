import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function getRandomNumber(limit: number): number {
  return Math.floor(Math.random() * limit);
}

function filterSymbols(excludeSymbols: string[], group: string): string {
  let newGroup = group;
  excludeSymbols.forEach((symbol) => {
    newGroup = newGroup.replace(new RegExp(symbol, "g"), "");
  });
  return newGroup;
}

function createId(availableChars: string[], idLength: number): string {
  let id = "";
  for (let i = 0; i < idLength; i++) {
    id += availableChars[getRandomNumber(availableChars.length)];
  }
  return id;
}

interface GenerateUniqueIdOptions {
  length?: number;
  useLetters?: boolean;
  useNumbers?: boolean;
  includeSymbols?: string[];
  excludeSymbols?: string[];
}

export function generateUniqueId({
  length = 20,
  useLetters = true,
  useNumbers = true,
  includeSymbols = [],
  excludeSymbols = [],
}: GenerateUniqueIdOptions = {}): string {
  let letters = "abcdefghijklmnopqrstuvwxyz";
  let numbers = "0123456789";
  let availableChars: string[] = [];
  let lettersArr: string[] = [];
  let numbersArr: string[] = [];

  if (useLetters) {
    if (excludeSymbols.length) letters = filterSymbols(excludeSymbols, letters);
    lettersArr = letters.split("");
  }

  if (useNumbers) {
    if (excludeSymbols.length) numbers = filterSymbols(excludeSymbols, numbers);
    numbersArr = numbers.split("");
  }

  availableChars = [...lettersArr, ...numbersArr, ...includeSymbols];

  return createId(availableChars, length);
}

export type ApiSuccess<T> = { success: true } & T;
export type ApiFailure = { success: false; message: string };
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function fetchApi<T>(
  path: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (typeof window === "undefined") {
    try {
      const headerList = await (await import("next/headers")).headers();
      const cookie = headerList.get("cookie");
      if (cookie) {
        requestHeaders["Cookie"] = cookie;
      }
    } catch (_error) {
      // Ignored: Happens if fetchApi is called outside a request context (e.g. static generation)
    }
  }
  const fetchOptions: RequestInit = {
    ...options,
    headers: requestHeaders,
    credentials: "include",
  };
  const res = await fetch(`${BASEURL}/api/${path}`, fetchOptions);
  console.log("fetchApi", path, res.status);
  if (!res.ok) {
    if (res.status === 403 || res.status === 401) {
      console.error("Auth failed for path:", path);
    }
    throw new ApiError(res.status, await res.text());
  }

  return (await res.json()) as ApiResponse<T>;
}
export const jsvatToStripeTaxId: Record<string, string> = {
  // --- EU countries ---
  AT: "eu_vat", // Austria
  BE: "eu_vat", // Belgium
  BG: "bg_uic", // Bulgaria
  CY: "eu_vat", // Cyprus
  CZ: "eu_vat", // Czech Republic
  DE: "de_stn", // Germany
  DK: "eu_vat", // Denmark
  EE: "eu_vat", // Estonia
  EL: "eu_vat", // Greece (VIES uses "EL" instead of "GR")
  ES: "es_cif", // Spain
  FI: "eu_vat", // Finland
  FR: "eu_vat", // France
  GB: "gb_vat", // United Kingdom
  HR: "hr_oib", // Croatia
  HU: "hu_tin", // Hungary
  IE: "eu_vat", // Ireland
  IT: "eu_vat", // Italy
  LT: "eu_vat", // Lithuania
  LU: "eu_vat", // Luxembourg
  LV: "eu_vat", // Latvia
  MT: "eu_vat", // Malta
  NL: "eu_vat", // Netherlands
  PL: "eu_vat", // Poland
  PT: "eu_vat", // Portugal
  RO: "ro_tin", // Romania
  SE: "eu_vat", // Sweden
  SI: "si_tin", // Slovenia
  SK: "eu_vat", // Slovakia

  // --- EFTA ---
  CH: "ch_vat", // Switzerland
  IS: "is_vat", // Iceland
  LI: "li_vat", // Liechtenstein
  NO: "no_vat", // Norway

  // --- Non-EU extras sometimes in jsvat ---
  RU: "ru_inn", // Russia
  TR: "tr_tin", // Turkey
  UA: "ua_vat", // Ukraine

  // --- fallback ---
  DEFAULT: "eu_vat",
};

// helper function
export function mapJsvatToStripe(code: string): string {
  return jsvatToStripeTaxId[code.toUpperCase()] || jsvatToStripeTaxId.DEFAULT;
}

export function getBaseUrl() {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
}

export const BASEURL = getBaseUrl();

export function deepEqual<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true;

  if (
    typeof a !== "object" ||
    typeof b !== "object" ||
    a === null ||
    b === null
  ) {
    return false;
  }

  // Arrays
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;

    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  const isEmptyObject = (obj: unknown): boolean => {
    if (typeof obj !== "object" || obj === null) return false;
    const values = Object.values(obj);
    return (
      values.length > 0 &&
      values.every(
        (v) =>
          v === undefined ||
          (typeof v === "object" && v !== null && isEmptyObject(v)),
      )
    );
  };

  const normalizedA = a === undefined || isEmptyObject(a) ? undefined : a;
  const normalizedB = b === undefined || isEmptyObject(b) ? undefined : b;

  if (normalizedA === undefined && normalizedB === undefined) return true;
  if (normalizedA === undefined || normalizedB === undefined) return false;

  const keysA = Object.keys(normalizedA) as (keyof T)[];
  const keysB = Object.keys(normalizedB) as (keyof T)[];

  const allKeys = new Set([...keysA, ...keysB]);

  for (const key of allKeys) {
    const valueA = normalizedA[key];
    const valueB = normalizedB[key];

    const normalizedValueA =
      valueA === undefined ||
      (typeof valueA === "object" && valueA !== null && isEmptyObject(valueA))
        ? undefined
        : valueA;
    const normalizedValueB =
      valueB === undefined ||
      (typeof valueB === "object" && valueB !== null && isEmptyObject(valueB))
        ? undefined
        : valueB;

    if (!deepEqual(normalizedValueA, normalizedValueB)) return false;
  }

  return true;
}

export type LeanDocument<T> = T & { $locals?: never };
