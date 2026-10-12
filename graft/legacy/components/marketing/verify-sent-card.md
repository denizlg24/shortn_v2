# legacy/components/marketing/verify-sent-card.tsx

- Status · type · L17-L21 — type Status = | { kind: "idle" } | { kind: "loading" } | { kind: "success"; message: string } | { kind: "error"; message: string };
- isValidEmail · function · L23-L25 — function isValidEmail(email: string)
- VerifySentCard · function · L27-L263 — function VerifySentCard({ initialEmail }: { initialEmail?: string })
- onResend · function · L46-L83 — onResend = async ()
