# legacy/lib/utils.ts

- cn · function · L4-L6 — function cn(...inputs: ClassValue[])
- getRandomNumber · function · L8-L10 — function getRandomNumber(limit: number): number
- filterSymbols · function · L12-L18 — function filterSymbols(excludeSymbols: string[], group: string): string
- createId · function · L20-L26 — function createId(availableChars: string[], idLength: number): string
- GenerateUniqueIdOptions · interface · L28-L34 — interface GenerateUniqueIdOptions
- generateUniqueId · function · L36-L62 — function generateUniqueId({ length = 20, useLetters = true, useNumbers = true, includeSymbols = [], excludeSymbols = [], }: GenerateUniqueIdOptions = {}): string
- ApiSuccess · type · L64-L64 — type ApiSuccess<T> = { success: true } & T;
- ApiFailure · type · L65-L65 — type ApiFailure = { success: false; message: string };
- ApiResponse · type · L66-L66 — type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
- ApiError · class · L68-L74 — class ApiError extends Error
- constructor · method · L70-L73 — constructor(status: number, message: string)
- fetchApi · function · L76-L109 — async function fetchApi<T>( path: string, options: RequestInit = {}, ): Promise<ApiResponse<T>>
- getBaseUrl · function · L111-L125 — function getBaseUrl()
- getShortUrl · function · L129-L131 — function getShortUrl(urlCode: string): string
- deepEqual · function · L133-L199 — function deepEqual<T>(a: T, b: T): boolean
- isEmptyObject · function · L156-L167 — isEmptyObject = (obj: unknown): boolean
- LeanDocument · type · L201-L201 — type LeanDocument<T> = T & { $locals?: never };
- escapeRegex · function · L207-L209 — function escapeRegex(str: string): string
