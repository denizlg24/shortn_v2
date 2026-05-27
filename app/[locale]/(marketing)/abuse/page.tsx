import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function generateMetadata() {
  return {
    title: "Abuse Policy — Shortn",
    description:
      "How Shortn detects, prevents, and responds to abusive, malicious, and phishing links. Report abuse to abuse@shortn.at.",
    openGraph: {
      title: "Abuse Policy — Shortn",
      description:
        "How Shortn detects, prevents, and responds to abusive and malicious links.",
      type: "website",
      siteName: "Shortn",
    },
  };
}

export default async function AbusePolicyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="space-y-8">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">Abuse Policy</h1>
          <p className="text-muted-foreground">Last updated: May 27, 2026</p>
        </div>

        <section className="space-y-4">
          <p className="text-lg">
            Shortn is committed to keeping our link shortening service free of
            malware, phishing, spam, and other abuse. This policy explains how
            we detect abusive links, what happens when a link is flagged, and
            how you can report or appeal.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">1. Prohibited Content</h2>
          <p className="text-muted-foreground">
            You may not create short links that point to:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>Phishing pages or credential-harvesting sites</li>
            <li>Malware, viruses, or malicious downloads</li>
            <li>Executable or installer files distributed deceptively</li>
            <li>Private, internal, or loopback network addresses</li>
            <li>Spam, scams, or fraudulent schemes</li>
            <li>Content that is illegal in the applicable jurisdiction</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">
            2. Automated Detection and Risk Scoring
          </h2>
          <p className="text-muted-foreground">
            Before a short link becomes active, we validate its destination and
            reject raw IP addresses, private and localhost addresses, executable
            downloads, and other high-risk patterns. We then scan the
            destination against trusted reputation sources (including Google Web
            Risk) and assess the domain&apos;s registration age, assigning a
            risk score from 0 to 100.
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">Low risk</span> —
              the link redirects normally.
            </li>
            <li>
              <span className="font-medium text-foreground">Elevated risk</span>{" "}
              — visitors see an interstitial safety page with a warning before
              they can continue.
            </li>
            <li>
              <span className="font-medium text-foreground">High risk</span> —
              the link is automatically disabled and shows a blocked notice
              instead of redirecting.
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">3. Safety Interstitial</h2>
          <p className="text-muted-foreground">
            For many links, visitors first see a preview page showing the
            destination domain, full URL, the link creator (when available), the
            creation date, and the current safety status. A short countdown
            precedes the option to continue, giving visitors a chance to verify
            the destination.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">4. Reporting Abuse</h2>
          <p className="text-muted-foreground">
            Every safety page includes a &ldquo;Report Link&rdquo; action. You
            can also email{" "}
            <a href="mailto:abuse@shortn.at" className="text-primary underline">
              abuse@shortn.at
            </a>{" "}
            with the short link and a description of the issue. Links that
            accumulate multiple reports are automatically disabled pending
            review.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">5. Enforcement and Appeals</h2>
          <p className="text-muted-foreground">
            We may disable links, suspend accounts, and cooperate with law
            enforcement in response to abuse. If you believe a link was disabled
            in error, contact{" "}
            <a href="mailto:abuse@shortn.at" className="text-primary underline">
              abuse@shortn.at
            </a>{" "}
            to appeal. See also our{" "}
            <Link href="/terms" className="text-primary underline">
              Terms of Service
            </Link>
            .
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">6. Contact</h2>
          <p className="text-muted-foreground">
            Abuse and security reports:{" "}
            <a href="mailto:abuse@shortn.at" className="text-primary underline">
              abuse@shortn.at
            </a>
            . Security researchers can review our{" "}
            <a
              href="/.well-known/security.txt"
              className="text-primary underline"
            >
              security.txt
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
