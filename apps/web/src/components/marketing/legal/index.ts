import type { ComponentType } from "react";
import type { Locale } from "@/i18n/locale";
import * as abuse from "./abuse";
import * as privacy from "./privacy";
import * as terms from "./terms";

export interface LegalDocument {
  title: string;
  updated: string;
  sections: readonly { id: string; title: string }[];
  Body: ComponentType<{ locale: Locale }>;
}

export const legalDocuments = {
  abuse,
  privacy,
  terms,
} satisfies Record<string, LegalDocument>;
