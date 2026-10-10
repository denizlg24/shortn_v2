export const nameMaxLength = 64;
export const usernameMinLength = 3;
export const usernameMaxLength = 32;
export const passwordMinLength = 8;
export const passwordMaxLength = 128;

// packages/auth enforces the same minimums (username plugin min 3,
// better-auth's default minPasswordLength 8).
export const serverUsernameMinLength = usernameMinLength;
export const serverPasswordMinLength = passwordMinLength;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isEmail = (value: string) => emailPattern.test(value);

export type PasswordCheck = "length" | "uppercase" | "number" | "special";

export const passwordChecks = (
  password: string,
): Array<{ check: PasswordCheck; met: boolean }> => [
  { check: "length", met: password.length >= passwordMinLength },
  { check: "uppercase", met: /[A-Z]/.test(password) },
  { check: "number", met: /[0-9]/.test(password) },
  { check: "special", met: /[^a-zA-Z0-9]/.test(password) },
];

export const meetsPasswordPolicy = (password: string) =>
  passwordChecks(password).every((item) => item.met);

export type UsernameIssue = "required" | "length" | "format" | "digits";

export function usernameIssue(username: string): UsernameIssue | null {
  if (!username) return "required";
  if (
    username.length < usernameMinLength ||
    username.length > usernameMaxLength
  )
    return "length";
  if (!/^[a-zA-Z0-9_]+$/.test(username)) return "format";
  if (/^\d+$/.test(username)) return "digits";
  return null;
}

export const normalizeUsername = (value: string) =>
  value.toLowerCase().replace(/\s/g, "_");
