import type { StaticImageData } from "next/image";
import analyticsLight from "./analytics-light.webp";
import analyticsDark from "./analytics-dark.webp";
import apiKeysLight from "./apiKeys-light.webp";
import apiKeysDark from "./apiKeys-dark.webp";
import bioEditorLight from "./bioEditor-light.webp";
import bioEditorDark from "./bioEditor-dark.webp";
import bioPhoneLight from "./bioPhone-light.webp";
import bioPhoneDark from "./bioPhone-dark.webp";
import campaignLight from "./campaign-light.webp";
import campaignDark from "./campaign-dark.webp";
import importsLight from "./imports-light.webp";
import importsDark from "./imports-dark.webp";
import linkRulesLight from "./linkRules-light.webp";
import linkRulesDark from "./linkRules-dark.webp";
import linksLight from "./links-light.webp";
import linksDark from "./links-dark.webp";
import membersLight from "./members-light.webp";
import membersDark from "./members-dark.webp";
import qrDesignLight from "./qrDesign-light.webp";
import qrDesignDark from "./qrDesign-dark.webp";
import safetyLight from "./safety-light.webp";
import safetyDark from "./safety-dark.webp";
import webhooksLight from "./webhooks-light.webp";
import webhooksDark from "./webhooks-dark.webp";

// Captured from a seeded loopback sandbox (`bun run shots:marketing`), never
// from a customer workspace (21 §6).
export const shots = {
  analytics: { light: analyticsLight, dark: analyticsDark },
  apiKeys: { light: apiKeysLight, dark: apiKeysDark },
  bioEditor: { light: bioEditorLight, dark: bioEditorDark },
  bioPhone: { light: bioPhoneLight, dark: bioPhoneDark },
  campaign: { light: campaignLight, dark: campaignDark },
  imports: { light: importsLight, dark: importsDark },
  linkRules: { light: linkRulesLight, dark: linkRulesDark },
  links: { light: linksLight, dark: linksDark },
  members: { light: membersLight, dark: membersDark },
  qrDesign: { light: qrDesignLight, dark: qrDesignDark },
  safety: { light: safetyLight, dark: safetyDark },
  webhooks: { light: webhooksLight, dark: webhooksDark },
} satisfies Record<string, { light: StaticImageData; dark: StaticImageData }>;

export type ShotName = keyof typeof shots;
