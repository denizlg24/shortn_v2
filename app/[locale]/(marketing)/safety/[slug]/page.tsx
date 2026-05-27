import { connectDB } from "@/lib/mongodb";
import UrlV3 from "@/models/url/UrlV3";
import { User } from "@/models/auth/User";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { SafetyInterstitial } from "./safety-interstitial";
import { BlockedView } from "./blocked-view";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return {
    title: "Safety check — Shortn",
    robots: { index: false, follow: false },
  };
}

export default async function SafetyPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  await connectDB();
  const doc = await UrlV3.findOne({ urlCode: slug }).lean();

  if (!doc) {
    redirect(`/${locale}/url-not-found`);
  }

  const blocked =
    doc.disabled ||
    doc.safetyStatus === "blocked" ||
    doc.safetyStatus === "malicious";

  if (blocked) {
    return <BlockedView slug={slug} reason={doc.disabledReason} />;
  }

  let creatorName: string | null = null;
  if (doc.sub) {
    const creator = await User.findOne({ sub: doc.sub }).select("name").lean();
    creatorName = creator?.name ?? null;
  }

  let destinationDomain = "";
  try {
    destinationDomain = new URL(doc.longUrl).hostname;
  } catch {
    destinationDomain = doc.longUrl;
  }

  return (
    <SafetyInterstitial
      slug={slug}
      destinationUrl={doc.longUrl}
      destinationDomain={destinationDomain}
      creatorName={creatorName}
      createdAt={doc.date.toISOString()}
      safetyStatus={doc.safetyStatus}
      riskScore={doc.riskScore}
    />
  );
}
