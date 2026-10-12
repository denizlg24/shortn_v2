# legacy/lib/rate-limit.ts

- RateLimitResult · interface · L8-L13 — interface RateLimitResult
- RateLimitConfig · interface · L15-L19 — interface RateLimitConfig
- RateLimitPreset · type · L59-L59 — type RateLimitPreset = keyof typeof RATE_LIMIT_PRESETS;
- AuthResult · interface · L64-L79 — interface AuthResult
- checkAuth · function · L85-L103 — async function checkAuth(request: NextRequest): Promise<AuthResult>
- checkAuthFromHeaders · function · L108-L126 — async function checkAuthFromHeaders(): Promise<AuthResult>
- protectRoute · function · L132-L199 — async function protectRoute( request: NextRequest, options: { requireAuth?: boolean; rateLimit?: { identifier: string; preset?: RateLimitPreset; config?: Partial<RateLimitConfig>; }; }, ): Promise<{ error: NextResponse | null; auth: AuthResult; rateLimit: RateLimitResult | null; }>
- createRateLimitIdentifier · function · L204-L224 — function createRateLimitIdentifier( prefix: string, request: NextRequest, options?: { includeUserId?: string; includeParam?: string; }, ): string
- checkRateLimit · function · L232-L313 — async function checkRateLimit( identifier: string, config: Partial<RateLimitConfig> = {}, ): Promise<RateLimitResult>
- resetRateLimit · function · L319-L322 — async function resetRateLimit(identifier: string): Promise<void>
- getClientIp · function · L329-L331 — function getClientIp(request: Request): string
- formatBlockedTime · function · L338-L352 — function formatBlockedTime(blockedUntil: Date): string
