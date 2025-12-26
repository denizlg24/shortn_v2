import { getTranslations, setRequestLocale } from "next-intl/server";
import Link from "next/link";

export async function generateMetadata() {
  const t = await getTranslations("metadata");

  return {
    title: t("terms.title"),
    description: t("terms.description"),
    keywords: t("terms.keywords")
      .split(",")
      .map((k) => k.trim()),
    openGraph: {
      title: t("terms.title"),
      description: t("terms.description"),
      type: "website",
      siteName: "Shortn",
    },
    twitter: {
      card: "summary_large_image",
      title: t("terms.title"),
      description: t("terms.description"),
    },
  };
}

export default async function TermsPage({
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
          <h1 className="text-4xl font-bold tracking-tight">
            Terms of Service
          </h1>
          <p className="text-muted-foreground">
            Last updated: December 22, 2025
          </p>
        </div>

        <section className="space-y-4">
          <p className="text-lg">
            Welcome to Shortn. These Terms of Service ("Terms") govern your use
            of our URL shortening service, QR code generation, and bio page
            creation services (collectively, the "Service"). By accessing or
            using the Service, you agree to be bound by these Terms.
          </p>
          <p className="text-muted-foreground">
            Please read these Terms carefully. If you do not agree to these
            Terms, you may not use the Service.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">1. Acceptance of Terms</h2>
          <p className="text-muted-foreground">
            By creating an account, accessing, or using Shortn, you acknowledge
            that you have read, understood, and agree to be bound by these Terms
            and our Privacy Policy. If you are using the Service on behalf of an
            organization, you represent and warrant that you have the authority
            to bind that organization to these Terms.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">2. Eligibility</h2>
          <p className="text-muted-foreground">
            You must be at least 13 years old to use the Service. If you are
            under 18, you represent that you have your parent or guardian's
            permission to use the Service. By using the Service, you represent
            and warrant that you meet these eligibility requirements.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">3. Account Registration</h2>
          <div className="space-y-4 pl-4">
            <div>
              <h3 className="text-xl font-medium mb-2">3.1 Account Creation</h3>
              <p className="text-muted-foreground">
                To access certain features of the Service, you must create an
                account. You agree to:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-2">
                <li>Provide accurate, current, and complete information</li>
                <li>
                  Maintain and update your information to keep it accurate
                </li>
                <li>
                  Maintain the security of your password and accept
                  responsibility for all activities under your account
                </li>
                <li>
                  Notify us immediately of any unauthorized access or security
                  breach
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-xl font-medium mb-2">
                3.2 Account Responsibility
              </h3>
              <p className="text-muted-foreground">
                You are responsible for all activities that occur under your
                account. We are not liable for any loss or damage arising from
                your failure to maintain the security of your account.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">4. Service Description</h2>
          <p className="text-muted-foreground">Shortn provides:</p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>URL shortening services with custom aliases</li>
            <li>QR code generation for shortened URLs</li>
            <li>Bio page creation and management (link-in-bio)</li>
            <li>Click analytics and tracking</li>
            <li>Link management and organization tools</li>
            <li>Campaign tracking and tagging features</li>
          </ul>
          <p className="text-muted-foreground mt-4">
            We reserve the right to modify, suspend, or discontinue any aspect
            of the Service at any time, with or without notice.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">
            5. Subscription Plans and Billing
          </h2>
          <div className="space-y-4 pl-4">
            <div>
              <h3 className="text-xl font-medium mb-2">5.1 Plans</h3>
              <p className="text-muted-foreground">
                We offer different subscription plans (Free, Basic, Plus, and
                Pro) with varying features and usage limits. Plan details,
                features, and pricing are available on our pricing page.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-medium mb-2">
                5.2 Payment Processing
              </h3>
              <p className="text-muted-foreground">
                All payment processing is handled by our payment service
                provider, Polar.sh. By subscribing to a paid plan, you agree to
                Polar's{" "}
                <a
                  href="https://polar.sh/legal/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Terms of Service
                </a>{" "}
                and{" "}
                <a
                  href="https://polar.sh/legal/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Privacy Policy
                </a>
                . We do not store your payment card details.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-medium mb-2">5.3 Billing</h3>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>
                  Subscriptions are billed monthly or annually, depending on
                  your selected plan
                </li>
                <li>
                  You will be charged at the beginning of each billing period
                </li>
                <li>
                  All fees are non-refundable except as required by law or as
                  expressly stated in these Terms
                </li>
                <li>
                  We reserve the right to change our pricing with 30 days'
                  notice
                </li>
                <li>
                  If your payment fails, we may suspend or terminate your access
                  to paid features
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-xl font-medium mb-2">
                5.4 Upgrades and Downgrades
              </h3>
              <p className="text-muted-foreground">
                You may upgrade or downgrade your plan at any time:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-2">
                <li>
                  Upgrades take effect immediately, and you will be charged a
                  prorated amount
                </li>
                <li>
                  Downgrades take effect at the end of your current billing
                  cycle
                </li>
                <li>
                  You may schedule a downgrade or cancellation to take effect at
                  the end of your billing period
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-xl font-medium mb-2">5.5 Cancellation</h3>
              <p className="text-muted-foreground">
                You may cancel your subscription at any time through your
                account settings or the billing portal. Cancellations take
                effect at the end of your current billing period. No refunds
                will be provided for partial billing periods.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-medium mb-2">5.6 Free Trial</h3>
              <p className="text-muted-foreground">
                We may offer free trials for certain plans. If you sign up for a
                free trial, you will be charged when the trial period ends
                unless you cancel before the trial expires.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">6. Acceptable Use Policy</h2>
          <p className="text-muted-foreground">
            You agree not to use the Service to:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>
              Violate any applicable laws, regulations, or third-party rights
            </li>
            <li>
              Create shortened links to malicious websites, phishing pages,
              malware, or illegal content
            </li>
            <li>
              Spam, harass, threaten, or abuse other users or third parties
            </li>
            <li>Distribute viruses, worms, or other harmful code</li>
            <li>Engage in fraudulent activities or impersonate others</li>
            <li>Infringe on intellectual property rights of others</li>
            <li>Collect or harvest personal information without consent</li>
            <li>
              Circumvent or attempt to circumvent any security or access control
              measures
            </li>
            <li>
              Use the Service to distribute adult content, hate speech, or
              violent content without appropriate warnings
            </li>
            <li>
              Use automated tools to access the Service in a manner that sends
              more requests than a human could reasonably produce
            </li>
            <li>
              Resell or redistribute the Service without our written permission
            </li>
            <li>
              Use the Service for cryptocurrency mining or similar
              resource-intensive activities
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">7. Content and Ownership</h2>
          <div className="space-y-4 pl-4">
            <div>
              <h3 className="text-xl font-medium mb-2">7.1 Your Content</h3>
              <p className="text-muted-foreground">
                You retain ownership of all content you submit to the Service,
                including URLs, custom aliases, QR codes, and bio pages. By
                submitting content, you grant us a worldwide, non-exclusive,
                royalty-free license to use, store, display, and distribute your
                content solely for the purpose of providing the Service.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-medium mb-2">
                7.2 Content Responsibility
              </h3>
              <p className="text-muted-foreground">
                You are solely responsible for all content you submit and the
                consequences of sharing that content. You represent and warrant
                that you have all necessary rights to the content you submit and
                that your content does not violate these Terms or any applicable
                laws.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-medium mb-2">7.3 Our Content</h3>
              <p className="text-muted-foreground">
                The Service, including its design, features, functionality,
                text, graphics, logos, and software, is owned by Shortn and is
                protected by copyright, trademark, and other intellectual
                property laws. You may not copy, modify, distribute, sell, or
                lease any part of the Service without our written permission.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-medium mb-2">7.4 Content Removal</h3>
              <p className="text-muted-foreground">
                We reserve the right to remove, disable, or modify any content
                that violates these Terms or that we determine, in our sole
                discretion, to be harmful, offensive, or otherwise
                objectionable.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">
            8. Analytics and Data Collection
          </h2>
          <p className="text-muted-foreground">
            When users click on your shortened links, we collect analytics data
            including but not limited to: IP addresses, device information,
            browser type, referrer, geographic location, and timestamp. This
            data is provided to you for analytics purposes. You are responsible
            for complying with all applicable privacy laws when using this
            analytics data.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">9. Termination</h2>
          <div className="space-y-4 pl-4">
            <div>
              <h3 className="text-xl font-medium mb-2">9.1 By You</h3>
              <p className="text-muted-foreground">
                You may terminate your account at any time by contacting us or
                using the account deletion feature in your settings. Upon
                termination, your access to the Service will be immediately
                revoked.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-medium mb-2">9.2 By Us</h3>
              <p className="text-muted-foreground">
                We may suspend or terminate your account and access to the
                Service at any time, with or without notice, for any reason,
                including but not limited to:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-2">
                <li>Violation of these Terms</li>
                <li>Fraudulent or illegal activity</li>
                <li>Non-payment of fees</li>
                <li>Abuse of the Service or harm to other users</li>
                <li>Extended periods of inactivity</li>
              </ul>
            </div>

            <div>
              <h3 className="text-xl font-medium mb-2">
                9.3 Effect of Termination
              </h3>
              <p className="text-muted-foreground">
                Upon termination, your shortened links may become inactive, and
                your data may be deleted. We are not responsible for any loss of
                data resulting from termination. Provisions that by their nature
                should survive termination will survive, including ownership
                provisions, warranty disclaimers, and limitations of liability.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">
            10. Disclaimers and Warranties
          </h2>
          <p className="text-muted-foreground uppercase font-semibold">
            The Service is provided "as is" and "as available" without
            warranties of any kind, either express or implied.
          </p>
          <p className="text-muted-foreground">
            We disclaim all warranties, including but not limited to:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>
              Warranties of merchantability and fitness for a particular purpose
            </li>
            <li>
              Warranties that the Service will be uninterrupted or error-free
            </li>
            <li>
              Warranties regarding the accuracy or reliability of any content
            </li>
            <li>Warranties that the Service will meet your requirements</li>
            <li>Warranties regarding the security of your data</li>
          </ul>
          <p className="text-muted-foreground mt-4">
            You use the Service at your own risk. We do not guarantee that the
            Service will be available at all times or that it will be free from
            viruses or other harmful components.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">
            11. Limitation of Liability
          </h2>
          <p className="text-muted-foreground uppercase font-semibold">
            To the maximum extent permitted by law, Shortn and its officers,
            directors, employees, and agents will not be liable for any
            indirect, incidental, special, consequential, or punitive damages,
            or any loss of profits or revenues, whether incurred directly or
            indirectly, or any loss of data, use, goodwill, or other intangible
            losses.
          </p>
          <p className="text-muted-foreground mt-4">
            Our total liability for any claims arising out of or relating to
            these Terms or the Service will not exceed the greater of:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>
              The amount you paid us in the 12 months preceding the claim, or
            </li>
            <li>$100 USD</li>
          </ul>
          <p className="text-muted-foreground mt-4">
            Some jurisdictions do not allow the exclusion or limitation of
            certain warranties or liabilities, so some of the above limitations
            may not apply to you.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">12. Indemnification</h2>
          <p className="text-muted-foreground">
            You agree to indemnify, defend, and hold harmless Shortn and its
            officers, directors, employees, agents, and affiliates from and
            against any claims, liabilities, damages, losses, costs, expenses,
            or fees (including reasonable attorneys' fees) arising out of or
            relating to:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>Your use of the Service</li>
            <li>Your violation of these Terms</li>
            <li>Your violation of any rights of another party</li>
            <li>Your content or any content submitted through your account</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">
            13. Dispute Resolution and Governing Law
          </h2>
          <div className="space-y-4 pl-4">
            <div>
              <h3 className="text-xl font-medium mb-2">
                13.1 Payment Disputes
              </h3>
              <p className="text-muted-foreground">
                Any disputes related to payments, billing, refunds, or
                subscriptions are handled by our payment processor, Polar.sh.
                Please contact Polar's support at{" "}
                <a
                  href="https://polar.sh/support"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  polar.sh/support
                </a>{" "}
                for payment-related issues.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-medium mb-2">
                13.2 Informal Resolution
              </h3>
              <p className="text-muted-foreground">
                Before filing a claim, you agree to contact us at{" "}
                <a
                  href="mailto:support@shortn.at"
                  className="text-primary hover:underline"
                >
                  support@shortn.at
                </a>{" "}
                to attempt to resolve the dispute informally.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-medium mb-2">13.3 Governing Law</h3>
              <p className="text-muted-foreground">
                These Terms shall be governed by and construed in accordance
                with the laws of the jurisdiction in which Shortn operates,
                without regard to its conflict of law provisions.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-medium mb-2">13.4 Arbitration</h3>
              <p className="text-muted-foreground">
                Any disputes arising out of or relating to these Terms or the
                Service will be resolved through binding arbitration, except
                where prohibited by law. You waive your right to participate in
                a class action lawsuit or class-wide arbitration.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">14. Changes to Terms</h2>
          <p className="text-muted-foreground">
            We reserve the right to modify these Terms at any time. We will
            notify you of material changes by posting the updated Terms on our
            website and updating the "Last updated" date. Your continued use of
            the Service after such modifications constitutes your acceptance of
            the updated Terms.
          </p>
          <p className="text-muted-foreground">
            If you do not agree to the modified Terms, you must stop using the
            Service and may terminate your account.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">15. Miscellaneous</h2>
          <div className="space-y-4 pl-4">
            <div>
              <h3 className="text-xl font-medium mb-2">
                15.1 Entire Agreement
              </h3>
              <p className="text-muted-foreground">
                These Terms, together with our Privacy Policy, constitute the
                entire agreement between you and Shortn regarding the Service.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-medium mb-2">15.2 Severability</h3>
              <p className="text-muted-foreground">
                If any provision of these Terms is found to be unenforceable,
                the remaining provisions will remain in full force and effect.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-medium mb-2">15.3 Waiver</h3>
              <p className="text-muted-foreground">
                Our failure to enforce any right or provision of these Terms
                will not constitute a waiver of such right or provision.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-medium mb-2">15.4 Assignment</h3>
              <p className="text-muted-foreground">
                You may not assign or transfer these Terms or your account
                without our written consent. We may assign these Terms without
                restriction.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-medium mb-2">15.5 Force Majeure</h3>
              <p className="text-muted-foreground">
                We will not be liable for any delay or failure to perform
                resulting from causes beyond our reasonable control, including
                but not limited to acts of God, war, terrorism, riots,
                embargoes, acts of civil or military authorities, fire, floods,
                accidents, strikes, or shortages of transportation facilities,
                fuel, energy, labor, or materials.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-medium mb-2">
                15.6 Third-Party Services
              </h3>
              <p className="text-muted-foreground">
                The Service may contain links to third-party websites or
                services. We are not responsible for the content, policies, or
                practices of any third-party websites or services. Your use of
                third-party services is at your own risk.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">16. Contact Information</h2>
          <p className="text-muted-foreground">
            If you have any questions about these Terms, please contact us:
          </p>
          <div className="pl-4 space-y-1 text-muted-foreground">
            <p>
              <strong>Email:</strong>{" "}
              <a
                href="mailto:geral@shortn.at"
                className="text-primary hover:underline"
              >
                geral@shortn.at
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

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">17. Acknowledgment</h2>
          <p className="text-muted-foreground">
            By using the Service, you acknowledge that you have read these Terms
            of Service and agree to be bound by them.
          </p>
        </section>

        <div className="pt-8 border-t">
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-primary transition-colors">
              Home
            </Link>
            <Link
              href="/privacy"
              className="hover:text-primary transition-colors"
            >
              Privacy Policy
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
