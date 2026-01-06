# Security Audit Report - Shortn V2

**Date:** 2025-01-06
**Application:** Shortn V2 (Next.js 16 URL Shortener)
**Audit Type:** Comprehensive Security Review

---

## Executive Summary

This audit identified **22 security vulnerabilities** across the application:

- **Critical:** 2
- **High:** 6
- **Medium:** 8
- **Low:** 6

Immediate action is required for Critical and High severity items before production deployment.

---

## Critical Vulnerabilities

### VULN-001: Insecure Internal API Secret Fallback

**Severity:** CRITICAL
**File:** `app/api/get-long-url/[slug]/route.ts` (line 8), `app/api/track-click/route.ts` (line 5)
**Type:** Authentication Weakness

**Description:**
The internal API secret falls back to AUTH_SECRET when INTERNAL_API_SECRET is undefined. This exposes the primary authentication secret for API-to-API calls.

**Vulnerable Code:**

```typescript
const INTERNAL_SECRET = env.INTERNAL_API_SECRET || env.AUTH_SECRET;
```

**Impact:**

- AUTH_SECRET exposure through timing attacks
- Compromise of internal API authentication
- Potential session hijacking if AUTH_SECRET is leaked

**Remediation:**

1. Open `utils/env.ts`
2. Change INTERNAL_API_SECRET from optional to required:

```typescript
INTERNAL_API_SECRET: z.string().min(32, "INTERNAL_API_SECRET must be at least 32 characters"),
```

3. Generate a strong secret and add to `.env`:

```bash
INTERNAL_API_SECRET=$(openssl rand -base64 32)
```

4. Update `app/api/track-click/route.ts` to remove fallback:

```typescript
const INTERNAL_SECRET = env.INTERNAL_API_SECRET;
if (!INTERNAL_SECRET) {
  console.error("INTERNAL_API_SECRET is not configured");
  return NextResponse.json(
    { error: "Server misconfiguration" },
    { status: 500 },
  );
}
```

---

### VULN-002: Missing Rate Limiting on Dashboard Stats Endpoint

**Severity:** CRITICAL
**File:** `app/api/dashboard/stats/route.ts`
**Type:** Denial of Service

**Description:**
The dashboard stats endpoint performs expensive MongoDB aggregation queries without rate limiting. An attacker can overwhelm the database with repeated requests.

**Vulnerable Code:**

```typescript
export async function GET() {
  const result = await getDashboardStats();
  // No rate limiting, runs 8 parallel database queries
}
```

**Impact:**

- Database resource exhaustion
- Service degradation for all users
- Potential cost increase on cloud databases

**Remediation:**

1. Open `app/api/dashboard/stats/route.ts`
2. Add rate limiting:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { protectRoute, createRateLimitIdentifier } from "@/lib/rate-limit";
import { getDashboardStats } from "@/app/actions/dashboardActions";

export async function GET(request: NextRequest) {
  const rateLimitId = createRateLimitIdentifier("dashboard_stats", request);
  const { error } = await protectRoute(request, {
    requireAuth: true,
    rateLimit: {
      identifier: rateLimitId,
      preset: "fetch",
    },
  });

  if (error) return error;

  const result = await getDashboardStats();
  if (!result.success) {
    return NextResponse.json(
      { success: false, message: result.message },
      { status: result.message === "no-user" ? 401 : 500 },
    );
  }
  return NextResponse.json({ success: true, data: result.data });
}
```

---

## High Severity Vulnerabilities

### VULN-003: NoSQL Injection in Link Search

**Severity:** HIGH
**File:** `app/actions/linkActions.ts` (lines 918-922)
**Type:** Injection

**Description:**
User search queries are passed directly to MongoDB $regex without escaping special characters.

**Vulnerable Code:**

```typescript
if (query && query.trim()) {
  filter.$or = [
    { title: { $regex: query, $options: "i" } },
    { urlCode: { $regex: query, $options: "i" } },
    { longUrl: { $regex: query, $options: "i" } },
  ];
}
```

**Impact:**

- ReDoS (Regular Expression Denial of Service)
- Potential data extraction through crafted regex patterns
- Application crash from malformed regex

**Remediation:**

1. Create escape utility in `lib/utils.ts`:

```typescript
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
```

2. Update `app/actions/linkActions.ts`:

```typescript
import { escapeRegex } from "@/lib/utils";

if (query && query.trim()) {
  const escapedQuery = escapeRegex(query.trim());
  filter.$or = [
    { title: { $regex: escapedQuery, $options: "i" } },
    { urlCode: { $regex: escapedQuery, $options: "i" } },
    { longUrl: { $regex: escapedQuery, $options: "i" } },
  ];
}
```

---

### VULN-004: Authorization Bypass in User Data Endpoints

**Severity:** HIGH
**File:** `app/api/pages/slug-by-url/[urlCode]/route.ts`
**Type:** Broken Access Control

**Description:**
The endpoint queries the database before checking if the user owns the requested resource. This confirms resource existence to unauthorized users.

**Vulnerable Code:**

```typescript
const url = await UrlV3.findOne({ urlCode });
if (!url) {
  return NextResponse.json({ success: false }, { status: 400 });
}
const session = await auth.api.getSession({ headers: request.headers });
// Auth check happens AFTER database query
```

**Impact:**

- Information disclosure about URL existence
- Enumeration of valid URL codes
- Privacy violation

**Remediation:**

1. Update `app/api/pages/slug-by-url/[urlCode]/route.ts`:

```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ urlCode: string }> },
) {
  // Check auth FIRST
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 },
    );
  }

  const { urlCode } = await params;
  await connectDB();

  // Include user ownership in query
  const url = await UrlV3.findOne({ urlCode, sub: session.user.sub });
  if (!url) {
    return NextResponse.json(
      { success: false, slug: undefined },
      { status: 404 },
    );
  }
  // ... rest of the logic
}
```

---

### VULN-005: Weak JWT Cookie Security

**Severity:** HIGH
**File:** `app/api/verify-link-password/route.ts` (lines 98-104)
**Type:** Session Security

**Description:**
The secure cookie flag uses NODE_ENV check instead of proper production detection, potentially sending cookies over unencrypted connections.

**Vulnerable Code:**

```typescript
response.cookies.set(`link_access_${urlCode}`, token, {
  secure: process.env.NODE_ENV === "production",
  // ...
});
```

**Impact:**

- Token interception on non-HTTPS connections
- Session hijacking in development/staging environments

**Remediation:**

1. Update `app/api/verify-link-password/route.ts`:

```typescript
response.cookies.set(`link_access_${urlCode}`, token, {
  httpOnly: true,
  secure: !!process.env.VERCEL_URL || process.env.NODE_ENV === "production",
  sameSite: "strict", // Changed from "lax" to "strict"
  maxAge: 86400,
  path: "/",
});
```

---

### VULN-006: Email Header Injection

**Severity:** HIGH
**File:** Email sending functions across multiple files
**Type:** Injection

**Description:**
User-provided email addresses and subject lines are passed to Resend without server-side sanitization.

**Impact:**

- Email header injection attacks
- Spam relay abuse
- Phishing through manipulated headers

**Remediation:**

1. Create email validation utility in `lib/email-utils.ts`:

```typescript
export function sanitizeEmailAddress(email: string): string | null {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  const trimmed = email.trim().toLowerCase();
  if (!emailRegex.test(trimmed) || trimmed.length > 254) {
    return null;
  }
  return trimmed;
}

export function sanitizeSubject(subject: string): string {
  // Remove newlines and carriage returns to prevent header injection
  return subject
    .replace(/[\r\n]/g, " ")
    .trim()
    .slice(0, 200);
}
```

2. Apply to all email sending functions.

---

### VULN-007: Missing Rate Limiting on Auth User Endpoints

**Severity:** HIGH
**File:** `app/api/auth/user/route.ts`, `app/api/auth/user/subscription/route.ts`
**Type:** Denial of Service

**Description:**
User info and subscription endpoints lack rate limiting, allowing enumeration and resource exhaustion.

**Remediation:**

1. Update `app/api/auth/user/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { protectRoute, createRateLimitIdentifier } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const rateLimitId = createRateLimitIdentifier("auth_user", request);
  const { error, auth } = await protectRoute(request, {
    requireAuth: true,
    rateLimit: {
      identifier: rateLimitId,
      preset: "api",
    },
  });

  if (error) return error;

  return NextResponse.json({
    success: true,
    user: auth.user,
  });
}
```

2. Apply same pattern to `app/api/auth/user/subscription/route.ts`.

---

### VULN-008: Click Data Storage Without Validation

**Severity:** HIGH
**File:** `app/actions/linkActions.ts` (lines 470-553)
**Type:** Input Validation

**Description:**
Click tracking data from middleware is stored without size limits or content validation.

**Impact:**

- Database bloat from oversized payloads
- Stored XSS if data is displayed
- Log injection attacks

**Remediation:**

1. Add validation in `app/actions/linkActions.ts` before click storage:

```typescript
function sanitizeClickData(data: {
  userAgent?: string;
  referrer?: string;
  queryParams?: Record<string, string>;
}): {
  userAgent: string;
  referrer: string;
  queryParams: Record<string, string>;
} {
  return {
    userAgent: (data.userAgent || "").slice(0, 500),
    referrer: (data.referrer || "").slice(0, 2000),
    queryParams: Object.fromEntries(
      Object.entries(data.queryParams || {})
        .slice(0, 20)
        .map(([k, v]) => [k.slice(0, 50), String(v).slice(0, 200)]),
    ),
  };
}
```

---

## Medium Severity Vulnerabilities

### VULN-009: XSS in Email Templates

**Severity:** MEDIUM
**File:** `lib/email-templates.ts`, various email functions
**Type:** Cross-Site Scripting

**Description:**
User-provided data (names, emails) is interpolated into HTML templates without escaping.

**Remediation:**

1. Install escape library: `bun add escape-html`
2. Apply to all email templates:

```typescript
import escapeHtml from "escape-html";

const safeUserName = escapeHtml(userName);
const safeEmail = escapeHtml(email);
```

---

### VULN-010: Missing CSRF Protection

**Severity:** MEDIUM
**File:** Application-wide
**Type:** Cross-Site Request Forgery

**Description:**
The application relies solely on SameSite cookie policy without explicit CSRF tokens.

**Remediation:**

1. Better-Auth includes CSRF protection by default. Verify it is enabled in `lib/auth.ts`:

```typescript
const options = {
  // ... existing config
  advanced: {
    // ... existing advanced config
    csrf: {
      checkOrigin: true,
    },
  },
};
```

---

### VULN-011: Path Traversal in File Operations

**Severity:** MEDIUM
**File:** `app/actions/deletePicture.ts`
**Type:** Path Traversal

**Description:**
CID extraction from URL does not validate the format before use.

**Remediation:**

```typescript
const cid = oldPic.split("/ipfs/")[1];
const cidRegex = /^[a-zA-Z0-9]{46,59}$/;
if (!cid || !cidRegex.test(cid)) {
  throw new Error("Invalid IPFS CID format");
}
```

---

### VULN-012: Timing Side-Channel in Rate Limiting

**Severity:** MEDIUM
**File:** `lib/rate-limit.ts`
**Type:** Information Disclosure

**Description:**
Rate limit comparisons do not use constant-time operations.

**Remediation:**

For critical comparisons, use:

```typescript
import { timingSafeEqual } from "crypto";

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
```

---

### VULN-013: Excessive Error Information Leakage

**Severity:** MEDIUM
**File:** Various API routes
**Type:** Information Disclosure

**Description:**
Error responses sometimes reveal internal system state.

**Remediation:**

Standardize error responses:

```typescript
// Create lib/api-error.ts
export function apiError(
  status: number,
  publicMessage: string,
  internalError?: unknown,
) {
  if (internalError) {
    console.error("[API Error]", internalError);
  }
  return NextResponse.json(
    { success: false, message: publicMessage },
    { status },
  );
}
```

---

### VULN-014: JWT Token Not Revocable

**Severity:** MEDIUM
**File:** `app/api/verify-link-password/route.ts`
**Type:** Session Management

**Description:**
Link access JWT tokens cannot be revoked before expiration.

**Remediation:**

Consider implementing:

1. Shorter token expiration (4-12 hours instead of 24)
2. Token blacklist in database for revoked tokens
3. Token refresh mechanism

---

### VULN-015: Missing Request Size Validation

**Severity:** MEDIUM
**File:** Various POST endpoints
**Type:** Denial of Service

**Description:**
While Next.js has a global body size limit, individual routes don't validate payload sizes.

**Remediation:**

Add to `protectRoute` utility:

```typescript
if (options.maxBodySize) {
  const contentLength = parseInt(request.headers.get("content-length") || "0");
  if (contentLength > options.maxBodySize) {
    return {
      error: NextResponse.json(
        { message: "Payload too large" },
        { status: 413 },
      ),
    };
  }
}
```

---

### VULN-016: Weak Password Hashing Rounds

**Severity:** MEDIUM
**File:** `app/actions/linkActions.ts` (line 151)
**Type:** Cryptography

**Description:**
bcrypt uses 10 rounds, which is the minimum acceptable.

**Remediation:**

```typescript
// Increase to 12 rounds
passwordHash = await bcrypt.hash(password, 12);
```

---

## Low Severity Vulnerabilities

### VULN-017: Missing Security Headers

**Severity:** LOW
**File:** `next.config.ts`
**Type:** Security Misconfiguration

**Remediation:**

Add to `next.config.ts`:

```typescript
async headers() {
  return [
    {
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-XSS-Protection', value: '1; mode=block' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
      ],
    },
  ];
},
```

---

### VULN-018: Missing Content Security Policy

**Severity:** LOW
**File:** Application headers
**Type:** Security Misconfiguration

**Remediation:**

Add CSP header (adjust based on your CDN and script sources):

```typescript
{
  key: 'Content-Security-Policy',
  value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
}
```

---

### VULN-019: Incomplete Webhook Validation

**Severity:** LOW
**File:** `app/api/polar/execute-downgrade/route.ts`
**Type:** Input Validation

**Remediation:**

Add schema validation for webhook payloads using Zod.

---

### VULN-020: Dependency Vulnerabilities

**Severity:** LOW
**File:** `package.json`
**Type:** Vulnerable Dependencies

**Remediation:**

```bash
bun pm audit
bun update
```

---

### VULN-021: Missing security.txt

**Severity:** LOW
**File:** Missing
**Type:** Security Best Practice

**Remediation:**

Create `public/.well-known/security.txt`:

```
Contact: security@yourdomain.com
Expires: 2026-01-01T00:00:00.000Z
Preferred-Languages: en
```

---

### VULN-022: Console Logging Sensitive Data

**Severity:** LOW
**File:** Various files
**Type:** Information Disclosure

**Remediation:**

Review and remove `console.log` statements that may leak:

- User IDs
- Email addresses
- Token fragments
- Internal paths

---

## Remediation Priority

### Week 1 - Critical (Immediate)

1. VULN-001: Fix internal API secret fallback
2. VULN-002: Add rate limiting to dashboard stats
3. VULN-003: Add regex escaping for search queries

### Week 2 - High

4. VULN-004: Fix authorization order in endpoints
5. VULN-005: Fix JWT cookie security
6. VULN-006: Add email sanitization
7. VULN-007: Add rate limiting to user endpoints
8. VULN-008: Add click data validation

### Week 3 - Medium

9. VULN-009 through VULN-016

### Week 4 - Low

10. VULN-017 through VULN-022

---

## Testing Checklist

After implementing fixes, verify:

- [ ] All API routes return 401 for unauthenticated requests (where required)
- [ ] Rate limiting triggers after threshold is exceeded
- [ ] Search queries with special regex characters are handled safely
- [ ] Users cannot access other users' resources
- [ ] Cookies have secure flag in production
- [ ] Email addresses are validated before sending
- [ ] Security headers are present in responses

---

## Recommended Security Tools

1. **OWASP ZAP** - Dynamic application security testing
2. **Snyk** - Dependency vulnerability scanning
3. **npm audit / bun pm audit** - Package security audit
4. **Sentry** - Runtime error monitoring
5. **Vercel WAF** - Web application firewall (if using Vercel)

---

## References

- OWASP Top 10: https://owasp.org/Top10/
- OWASP API Security Top 10: https://owasp.org/API-Security/
- Next.js Security: https://nextjs.org/docs/app/building-your-application/configuring/security
- Better-Auth Security: https://www.better-auth.com/docs/concepts/security
