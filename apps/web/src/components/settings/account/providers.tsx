import type { ComponentType } from "react";
import { GitHubIcon, GoogleIcon } from "@/components/auth/brand-icons";

export const linkableProviders = ["github", "google"] as const;
export type SocialProvider = (typeof linkableProviders)[number];

const names: Record<SocialProvider, string> = {
  github: "GitHub",
  google: "Google",
};

const icons: Record<SocialProvider, ComponentType> = {
  github: GitHubIcon,
  google: GoogleIcon,
};

export const isSocialProvider = (id: string): id is SocialProvider =>
  id === "github" || id === "google";

/** Brand names stay untranslated; unknown providers show their id. */
export const providerName = (id: string) =>
  isSocialProvider(id) ? names[id] : id;

export function ProviderIcon({ provider }: { provider: SocialProvider }) {
  const Icon = icons[provider];
  return <Icon />;
}
