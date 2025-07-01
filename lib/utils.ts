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
