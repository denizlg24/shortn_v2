# legacy/app/actions/userActions.ts

- sendReactEmailLegacy · function · L10-L29 — async function sendReactEmailLegacy({ react, email, subject, }: { react: ReactNode; email: string; subject: string; })
- sendRecoveryEmail · function · L31-L46 — async function sendRecoveryEmail(email: string, url: string)
- loginAttempt · function · L48-L77 — async function loginAttempt({ sub, success, location, ip, type, }: { sub: string; success: boolean; location: RequestGeo | undefined; ip: string | undefined; type: string; })
- getLoginRecordsCount · function · L79-L88 — async function getLoginRecordsCount({ sub }: { sub: string })
- getLoginRecords · function · L90-L113 — async function getLoginRecords({ limit, sub, }: { limit: number | undefined; sub: string; })
