import { setRequestLocale } from "next-intl/server";
import Link from "next/link";

export default async function PrivacyPage({
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
          <h1 className="text-4xl font-bold tracking-tight">Privacy Policy</h1>
          <p className="text-muted-foreground">
            Last updated: December 22, 2025
          </p>
        </div>

        <section className="space-y-4">
          <p className="text-lg">
            At Shortn ("we," "us," or "our"), we respect your privacy and are
            committed to protecting your personal data. This Privacy Policy
            explains how we collect, use, disclose, and safeguard your
            information when you use our URL shortening service.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">1. Information We Collect</h2>

          <div className="space-y-4 pl-4">
            <div>
              <h3 className="text-xl font-medium mb-2">
                1.1 Information You Provide
              </h3>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>
                  <strong>Account Information:</strong> Name, email address,
                  username, and password when you create an account
                </li>
                <li>
                  <strong>Profile Information:</strong> Display name, profile
                  picture, and phone number (optional)
                </li>
                <li>
                  <strong>Payment Information:</strong> Payment processing is
                  handled by our payment processor, Polar.sh. We do not store
                  your credit card details
                </li>
                <li>
                  <strong>Content:</strong> URLs you shorten, custom aliases, QR
                  codes, bio pages, and any metadata you provide
                </li>
                <li>
                  <strong>Communications:</strong> Messages you send to us
                  through contact forms or support channels
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-xl font-medium mb-2">
                1.2 Information Automatically Collected
              </h3>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>
                  <strong>Usage Data:</strong> Information about how you use our
                  service, including clicks, scans, and interactions with
                  shortened links
                </li>
                <li>
                  <strong>Device Information:</strong> IP address, browser type,
                  operating system, device type, and unique device identifiers
                </li>
                <li>
                  <strong>Location Data:</strong> Approximate geographic
                  location based on IP address
                </li>
                <li>
                  <strong>Cookies and Similar Technologies:</strong> We use
                  cookies and similar tracking technologies to maintain sessions
                  and analyze usage patterns
                </li>
                <li>
                  <strong>Analytics Data:</strong> Click-through rates, referrer
                  information, and performance metrics for your shortened links
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">
            2. How We Use Your Information
          </h2>
          <p className="text-muted-foreground">
            We use the information we collect for the following purposes:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>
              <strong>Provide Services:</strong> Create and manage shortened
              URLs, QR codes, and bio pages
            </li>
            <li>
              <strong>Account Management:</strong> Maintain your account,
              authenticate users, and provide customer support
            </li>
            <li>
              <strong>Analytics:</strong> Provide you with click analytics,
              visitor statistics, and performance insights
            </li>
            <li>
              <strong>Service Improvement:</strong> Analyze usage patterns to
              improve our service and develop new features
            </li>
            <li>
              <strong>Security:</strong> Detect, prevent, and address fraud,
              abuse, and security issues
            </li>
            <li>
              <strong>Communications:</strong> Send you service updates,
              security alerts, and support messages
            </li>
            <li>
              <strong>Marketing:</strong> Send promotional communications (with
              your consent, where required)
            </li>
            <li>
              <strong>Legal Compliance:</strong> Comply with legal obligations
              and enforce our Terms of Service
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">
            3. How We Share Your Information
          </h2>
          <p className="text-muted-foreground">
            We may share your information in the following circumstances:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>
              <strong>Payment Processing:</strong> Payment information is
              processed by Polar.sh, our payment service provider. Please refer
              to{" "}
              <a
                href="https://polar.sh/legal/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Polar's Privacy Policy
              </a>{" "}
              for details on how they handle your data
            </li>
            <li>
              <strong>Service Providers:</strong> Third-party vendors who
              perform services on our behalf (e.g., hosting, email delivery,
              analytics)
            </li>
            <li>
              <strong>Business Transfers:</strong> In connection with a merger,
              acquisition, or sale of assets
            </li>
            <li>
              <strong>Legal Requirements:</strong> When required by law or to
              protect our rights, safety, or property
            </li>
            <li>
              <strong>With Your Consent:</strong> With your explicit consent for
              specific purposes
            </li>
          </ul>
          <p className="text-muted-foreground">
            We do not sell your personal information to third parties.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">4. Data Retention</h2>
          <p className="text-muted-foreground">
            We retain your personal information for as long as necessary to
            provide our services and fulfill the purposes outlined in this
            Privacy Policy. Specifically:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>
              <strong>Account Data:</strong> Retained until you delete your
              account or request deletion
            </li>
            <li>
              <strong>Shortened Links:</strong> Retained indefinitely unless you
              delete them or delete your account
            </li>
            <li>
              <strong>Analytics Data:</strong> Aggregated data may be retained
              indefinitely for statistical purposes
            </li>
            <li>
              <strong>Legal Requirements:</strong> Some data may be retained
              longer to comply with legal obligations
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">5. Your Rights and Choices</h2>
          <p className="text-muted-foreground">
            Depending on your location, you may have the following rights:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>
              <strong>Access:</strong> Request access to your personal data
            </li>
            <li>
              <strong>Correction:</strong> Update or correct inaccurate
              information
            </li>
            <li>
              <strong>Deletion:</strong> Request deletion of your personal data
            </li>
            <li>
              <strong>Data Portability:</strong> Request a copy of your data in
              a machine-readable format
            </li>
            <li>
              <strong>Opt-Out:</strong> Unsubscribe from marketing
              communications
            </li>
            <li>
              <strong>Object:</strong> Object to certain processing of your data
            </li>
            <li>
              <strong>Restrict:</strong> Request restriction of processing in
              certain circumstances
            </li>
          </ul>
          <p className="text-muted-foreground">
            To exercise these rights, please contact us at{" "}
            <a
              href="mailto:privacy@shortn.at"
              className="text-primary hover:underline"
            >
              privacy@shortn.at
            </a>
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">6. Data Security</h2>
          <p className="text-muted-foreground">
            We implement appropriate technical and organizational measures to
            protect your personal information against unauthorized access, loss,
            destruction, or alteration. These measures include:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>Encryption of data in transit using SSL/TLS</li>
            <li>Secure storage of passwords using industry-standard hashing</li>
            <li>Regular security audits and vulnerability assessments</li>
            <li>Access controls and authentication mechanisms</li>
            <li>Employee training on data protection practices</li>
          </ul>
          <p className="text-muted-foreground">
            However, no method of transmission over the Internet is 100% secure.
            While we strive to protect your information, we cannot guarantee
            absolute security.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">7. Cookies and Tracking</h2>
          <p className="text-muted-foreground">
            We use cookies and similar tracking technologies to:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>Maintain your session and keep you logged in</li>
            <li>Remember your preferences and settings</li>
            <li>Analyze usage patterns and track link performance</li>
            <li>Improve security and prevent fraud</li>
          </ul>
          <p className="text-muted-foreground">
            You can control cookies through your browser settings. However,
            disabling cookies may affect the functionality of our service.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">8. Third-Party Links</h2>
          <p className="text-muted-foreground">
            Our service allows you to create shortened links to external
            websites. We are not responsible for the privacy practices or
            content of these third-party sites. We encourage you to review the
            privacy policies of any websites you visit through our shortened
            links.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">9. Children's Privacy</h2>
          <p className="text-muted-foreground">
            Our service is not directed to individuals under the age of 13. We
            do not knowingly collect personal information from children under
            13. If we become aware that we have collected information from a
            child under 13, we will take steps to delete such information
            promptly.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">
            10. International Data Transfers
          </h2>
          <p className="text-muted-foreground">
            Your information may be transferred to and processed in countries
            other than your country of residence. These countries may have
            different data protection laws. We ensure that appropriate
            safeguards are in place to protect your information in accordance
            with this Privacy Policy.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">11. European Users (GDPR)</h2>
          <p className="text-muted-foreground">
            If you are located in the European Economic Area (EEA), you have
            additional rights under the General Data Protection Regulation
            (GDPR):
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>Right to access your personal data</li>
            <li>Right to rectification of inaccurate data</li>
            <li>Right to erasure ("right to be forgotten")</li>
            <li>Right to restrict processing</li>
            <li>Right to data portability</li>
            <li>Right to object to processing</li>
            <li>Right to withdraw consent</li>
            <li>Right to lodge a complaint with a supervisory authority</li>
          </ul>
          <p className="text-muted-foreground">
            We process your data based on the following legal grounds: contract
            performance, legitimate interests, legal obligations, and your
            consent.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">
            12. California Users (CCPA)
          </h2>
          <p className="text-muted-foreground">
            If you are a California resident, you have rights under the
            California Consumer Privacy Act (CCPA):
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>Right to know what personal information we collect</li>
            <li>Right to know if we sell or share your personal information</li>
            <li>Right to access your personal information</li>
            <li>Right to delete your personal information</li>
            <li>Right to opt-out of the sale of your personal information</li>
            <li>Right to non-discrimination for exercising your rights</li>
          </ul>
          <p className="text-muted-foreground">
            We do not sell your personal information. To exercise your CCPA
            rights, please contact us at{" "}
            <a
              href="mailto:privacy@shortn.at"
              className="text-primary hover:underline"
            >
              privacy@shortn.at
            </a>
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">
            13. Changes to This Privacy Policy
          </h2>
          <p className="text-muted-foreground">
            We may update this Privacy Policy from time to time. We will notify
            you of any material changes by posting the new Privacy Policy on
            this page and updating the "Last updated" date. We encourage you to
            review this Privacy Policy periodically for any changes.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">14. Contact Us</h2>
          <p className="text-muted-foreground">
            If you have any questions about this Privacy Policy or our data
            practices, please contact us at:
          </p>
          <div className="pl-4 space-y-1 text-muted-foreground">
            <p>
              <strong>Email:</strong>{" "}
              <a
                href="mailto:privacy@shortn.at"
                className="text-primary hover:underline"
              >
                privacy@shortn.at
              </a>
            </p>
            <p>
              <strong>Support:</strong>{" "}
              <a
                href="mailto:support@shortn.at"
                className="text-primary hover:underline"
              >
                support@shortn.at
              </a>
            </p>
          </div>
        </section>

        <div className="pt-8 border-t">
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-primary transition-colors">
              Home
            </Link>
            <Link
              href="/terms"
              className="hover:text-primary transition-colors"
            >
              Terms of Service
            </Link>
            <Link
              href="/contact"
              className="hover:text-primary transition-colors"
            >
              Contact
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
