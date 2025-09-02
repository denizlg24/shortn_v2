import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


function getRandomNumber(limit: number): number {
  return Math.floor(Math.random() * limit);
}

function filterSymbols(excludeSymbols: string[], group: string): string {
  let newGroup = group;
  excludeSymbols.forEach((symbol) => {
    newGroup = newGroup.replace(new RegExp(symbol, 'g'), '');
  });
  return newGroup;
}

function createId(availableChars: string[], idLength: number): string {
  let id = '';
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
  let letters = 'abcdefghijklmnopqrstuvwxyz';
  let numbers = '0123456789';
  let availableChars: string[] = [];
  let lettersArr: string[] = [];
  let numbersArr: string[] = [];

  if (useLetters) {
    if (excludeSymbols.length) letters = filterSymbols(excludeSymbols, letters);
    lettersArr = letters.split('');
  }

  if (useNumbers) {
    if (excludeSymbols.length) numbers = filterSymbols(excludeSymbols, numbers);
    numbersArr = numbers.split('');
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
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const res = await fetch(`/api/${path}`, {
    ...options,
  });

  if (!res.ok) {
    throw new ApiError(res.status, await res.text());
  }

  return (await res.json()) as ApiResponse<T>;
}
export const jsvatToStripeTaxId: Record<string, string> = {
  // --- EU countries ---
  AT: "eu_vat",    // Austria
  BE: "eu_vat",    // Belgium
  BG: "bg_uic",    // Bulgaria
  CY: "eu_vat",    // Cyprus
  CZ: "eu_vat",    // Czech Republic
  DE: "de_stn",    // Germany
  DK: "eu_vat",    // Denmark
  EE: "eu_vat",    // Estonia
  EL: "eu_vat",    // Greece (VIES uses "EL" instead of "GR")
  ES: "es_cif",    // Spain
  FI: "eu_vat",    // Finland
  FR: "eu_vat",    // France
  GB: "gb_vat",    // United Kingdom
  HR: "hr_oib",    // Croatia
  HU: "hu_tin",    // Hungary
  IE: "eu_vat",    // Ireland
  IT: "eu_vat",    // Italy
  LT: "eu_vat",    // Lithuania
  LU: "eu_vat",    // Luxembourg
  LV: "eu_vat",    // Latvia
  MT: "eu_vat",    // Malta
  NL: "eu_vat",    // Netherlands
  PL: "eu_vat",    // Poland
  PT: "eu_vat",    // Portugal
  RO: "ro_tin",    // Romania
  SE: "eu_vat",    // Sweden
  SI: "si_tin",    // Slovenia
  SK: "eu_vat",    // Slovakia

  // --- EFTA ---
  CH: "ch_vat",    // Switzerland
  IS: "is_vat",    // Iceland
  LI: "li_vat",    // Liechtenstein
  NO: "no_vat",    // Norway

  // --- Non-EU extras sometimes in jsvat ---
  RU: "ru_inn",    // Russia
  TR: "tr_tin",    // Turkey
  UA: "ua_vat",    // Ukraine

  // --- fallback ---
  DEFAULT: "eu_vat",
};

// helper function
export function mapJsvatToStripe(code: string): string {
  return jsvatToStripeTaxId[code.toUpperCase()] || jsvatToStripeTaxId.DEFAULT;
}
