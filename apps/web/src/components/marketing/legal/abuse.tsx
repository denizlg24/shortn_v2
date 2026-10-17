// Ported verbatim from legacy (D-M6); wording changes need legal review.
import type { Locale } from "@/i18n/locale";

export const title = "Abuse Policy";
export const updated = "2026-05-27";
export const sections = [
  { id: "prohibited-content", title: "1. Prohibited Content" },
  {
    id: "automated-detection-and-risk-scoring",
    title: "2. Automated Detection and Risk Scoring",
  },
  { id: "safety-interstitial", title: "3. Safety Interstitial" },
  { id: "reporting-abuse", title: "4. Reporting Abuse" },
  { id: "enforcement-and-appeals", title: "5. Enforcement and Appeals" },
  { id: "contact", title: "6. Contact" },
];

export function Body({ locale }: { locale: Locale }) {
  return (
    <>
      <section>
        <p>
          Shortn is committed to keeping our link shortening service free of
          malware, phishing, spam, and other abuse. This policy explains how we
          detect abusive links, what happens when a link is flagged, and how you
          can report or appeal.
        </p>
      </section>

      <section>
        <h2 id="prohibited-content">1. Prohibited Content</h2>
        <p>You may not create short links that point to:</p>
        <ul>
          <li>Phishing pages or credential-harvesting sites</li>
          <li>Malware, viruses, or malicious downloads</li>
          <li>Executable or installer files distributed deceptively</li>
          <li>Private, internal, or loopback network addresses</li>
          <li>Spam, scams, or fraudulent schemes</li>
          <li>Content that is illegal in the applicable jurisdiction</li>
        </ul>
      </section>

      <section>
        <h2 id="automated-detection-and-risk-scoring">
          2. Automated Detection and Risk Scoring
        </h2>
        <p>
          Before a short link becomes active, we validate its destination and
          reject raw IP addresses, private and localhost addresses, executable
          downloads, and other high-risk patterns. We then scan the destination
          against trusted reputation sources (including Google Web Risk) and
          assess the domain&apos;s registration age, assigning a risk score from
          0 to 100.
        </p>
        <ul>
          <li>
            <span>Low risk</span> — the link redirects normally.
          </li>
          <li>
            <span>Elevated risk</span> — visitors see an interstitial safety
            page with a warning before they can continue.
          </li>
          <li>
            <span>High risk</span> — the link is automatically disabled and
            shows a blocked notice instead of redirecting.
          </li>
        </ul>
      </section>

      <section>
        <h2 id="safety-interstitial">3. Safety Interstitial</h2>
        <p>
          For many links, visitors first see a preview page showing the
          destination domain, full URL, the link creator (when available), the
          creation date, and the current safety status. A short countdown
          precedes the option to continue, giving visitors a chance to verify
          the destination.
        </p>
      </section>

      <section>
        <h2 id="reporting-abuse">4. Reporting Abuse</h2>
        <p>
          Every safety page includes a &ldquo;Report Link&rdquo; action. You can
          also email <a href="mailto:abuse@shortn.at">abuse@shortn.at</a> with
          the short link and a description of the issue. Links that accumulate
          multiple reports are automatically disabled pending review.
        </p>
      </section>

      <section>
        <h2 id="enforcement-and-appeals">5. Enforcement and Appeals</h2>
        <p>
          We may disable links, suspend accounts, and cooperate with law
          enforcement in response to abuse. If you believe a link was disabled
          in error, contact <a href="mailto:abuse@shortn.at">abuse@shortn.at</a>{" "}
          to appeal. See also our{" "}
          <a href={`/${locale}/terms`}>Terms of Service</a>.
        </p>
      </section>

      <section>
        <h2 id="contact">6. Contact</h2>
        <p>
          Abuse and security reports:{" "}
          <a href="mailto:abuse@shortn.at">abuse@shortn.at</a>. Security
          researchers can review our{" "}
          <a href="/.well-known/security.txt">security.txt</a>.
        </p>
      </section>
    </>
  );
}
