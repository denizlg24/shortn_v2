import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { RecoverForm } from "./recover-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.recover");
  return { title: t("metaTitle") };
}

export default function RecoverPage() {
  return <RecoverForm />;
}
