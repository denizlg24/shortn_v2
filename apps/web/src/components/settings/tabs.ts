// The settings sub-nav (17 §Settings): workspace pages, then the signed-in
// person's own pages. Each entry is a page; sub-pages highlight their entry.
export const settingsGroups = [
  { id: "workspace", items: ["general", "members", "billing", "domains"] },
  {
    id: "account",
    items: ["profile", "email", "password", "signIn", "sessions"],
  },
] as const;

export type SettingsItem = (typeof settingsGroups)[number]["items"][number];

const paths: Record<SettingsItem, string> = {
  general: "",
  members: "/members",
  billing: "/billing",
  domains: "/domains",
  profile: "/account",
  email: "/account/email",
  password: "/account/password",
  signIn: "/account/sign-in",
  sessions: "/account/sessions",
};

export const settingsHref = (slug: string, item: SettingsItem) =>
  `/${slug}/settings${paths[item]}`;

const accountPages: Record<string, SettingsItem> = {
  email: "email",
  password: "password",
  "sign-in": "signIn",
  sessions: "sessions",
};

export function settingsItemFromPath(pathname: string): SettingsItem {
  const [, , , section, page] = pathname.split("/");
  if (section === "members") return "members";
  if (section === "billing") return "billing";
  if (section === "domains") return "domains";
  if (section === "account") return (page && accountPages[page]) || "profile";
  return "general";
}
