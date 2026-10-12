# legacy/lib/auth.ts

- generateRandomString · function · L30-L36 — generateRandomString = ()
- openMongo · function · L38-L57 — function openMongo()
- liveMongo · function · L59-L62 — function liveMongo()
- forwardTo · function · L66-L74 — function forwardTo<T extends object>(resolve: () => T): T
- get · method · L68-L72 — get(_target, property)
- onError · method · L82-L84 — onError(error, ctx)
- usernameValidator · method · L407-L410 — usernameValidator(username)
- displayUsernameValidator · method · L411-L417 — displayUsernameValidator(displayUsername)
- SessionWithGeo · type · L782-L797 — type SessionWithGeo = { id: string; createdAt: Date; updatedAt: Date; userId: string; expiresAt: Date; token: string; ipAddress?: string | null; userAgent?: string | null; geo_city?: string | null; geo_country?: string | null; geo_country_region?: string | null; geo_region?: string | null; geo_latitude?: string | null; geo_longitude?: string | null; };
- ServerSession · type · L821-L821 — type ServerSession = typeof auth.$Infer.Session;
- ServerUser · type · L822-L822 — type ServerUser = (typeof auth.$Infer.Session)["user"];
