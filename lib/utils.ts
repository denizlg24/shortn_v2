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
