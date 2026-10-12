# apps/web/src/components/auth/rules.ts

- isEmail · function · L13-L13 — isEmail = (value: string)
- PasswordCheck · type · L15-L15 — type PasswordCheck = "length" | "uppercase" | "number" | "special";
- passwordChecks · function · L17-L24 — passwordChecks = ( password: string, ): Array<{ check: PasswordCheck; met: boolean }>
- meetsPasswordPolicy · function · L26-L27 — meetsPasswordPolicy = (password: string)
- UsernameIssue · type · L29-L29 — type UsernameIssue = "required" | "length" | "format" | "digits";
- usernameIssue · function · L31-L41 — function usernameIssue(username: string): UsernameIssue | null
- normalizeUsername · function · L43-L44 — normalizeUsername = (value: string)
