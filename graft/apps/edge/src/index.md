# apps/edge/src/index.ts

- Env · interface · L4-L16 — interface Env
- Fetch · type · L18-L18 — type Fetch = (request: Request) => Promise<Response>;
- bucket · function · L40-L45 — function bucket(rayId: string): number
- toRedirectOrigin · function · L47-L69 — function toRedirectOrigin(request: Request, env: Env): Request
- isWebPath · function · L77-L78 — isWebPath = (pathname: string)
- toWebOrigin · function · L82-L104 — function toWebOrigin( request: Request, origin: string, body: ArrayBuffer | null, ): Request
- createHandler · function · L109-L224 — function createHandler( upstream: Fetch, legacy: Fetch, timeoutMs = 3000, web: Fetch = upstream, )
