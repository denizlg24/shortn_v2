# apps/web/e2e/email.browser-flows.ts

- CapturedEmail · interface · L10-L15 — interface CapturedEmail
- checkEmailChange · function · L17-L211 — async function checkEmailChange({ browser, db, origin, emails, clientIp, authSecret, captureDir, }: { browser: Browser; db: Db; origin: string; emails: CapturedEmail[]; clientIp: string; authSecret: string; captureDir: string | undefined; })
- user · function · L78-L78 — user = ()
- mailFor · function · L79-L88 — mailFor = async (to: string)
- verificationLink · function · L89-L96 — verificationLink = (mail: CapturedEmail)
