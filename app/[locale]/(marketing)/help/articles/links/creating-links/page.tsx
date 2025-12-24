import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";

export default function CreatingLinks({
  params,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: any;
}) {
  const { locale } = use<{ locale: string }>(params);
  setRequestLocale(locale);

  return (
    <main className="flex flex-col items-start w-full max-w-4xl mx-auto px-4 py-12 gap-8">
      <Button asChild variant="ghost" size="sm">
        <Link href="/help">
          <ArrowLeft className="w-4 h-4" />
          Back to Help
        </Link>
      </Button>

      <div className="w-full space-y-2">
        <h1 className="text-4xl md:text-5xl font-bold">Creating Short Links</h1>
        <p className="text-lg text-muted-foreground">
          Learn how to create and customize your short links
        </p>
      </div>

      <Separator />

      <article className="w-full space-y-8 text-base leading-relaxed">
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Quick Create</h2>
          <p className="text-muted-foreground">
            The fastest way to shorten a link is through the Quick Create widget
            on your dashboard home:
          </p>
          <ol className="list-decimal pl-6 space-y-2 text-muted-foreground">
            <li>Paste any valid URL into the destination field</li>
            <li>Click the &quot;Shorten&quot; button</li>
            <li>Your short link is created instantly</li>
          </ol>
          {/* [SCREENSHOT: Quick create widget on dashboard home] */}
          <p className="text-muted-foreground mt-4">
            The system automatically generates a random 6-character code for
            your link. You&apos;ll be redirected to the link details page where
            you can customize it further.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Advanced Link Creation</h2>
          <p className="text-muted-foreground">
            For more control, use the full link creation page:
          </p>
          <ol className="list-decimal pl-6 space-y-3 text-muted-foreground">
            <li>
              Navigate to <strong>Links</strong> →{" "}
              <strong>Create New Link</strong>
            </li>
            <li>Enter your destination URL</li>
            <li>Add an optional title (helps you identify the link later)</li>
            <li>Choose tags to organize your links</li>
            <li>Set a custom back-half (Pro only)</li>
            <li>Add password protection (Pro only)</li>
          </ol>
          {/* [SCREENSHOT: Link creation form with all fields visible] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Custom Back-Halves</h2>
          <p className="text-muted-foreground">
            Pro users can create branded, memorable links with custom
            back-halves:
          </p>
          {/* [SCREENSHOT: Custom back-half input field] */}
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <p className="text-sm font-medium">Example:</p>
            <p className="text-sm text-muted-foreground">
              Instead of:{" "}
              <code className="bg-background px-2 py-1 rounded">
                shortn.at/a8K9xR
              </code>
            </p>
            <p className="text-sm text-muted-foreground">
              Create:{" "}
              <code className="bg-background px-2 py-1 rounded">
                shortn.at/summer-sale
              </code>
            </p>
          </div>
          <p className="text-muted-foreground mt-4">
            Custom back-halves must be unique and can contain letters, numbers,
            and hyphens.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Link Titles</h2>
          <p className="text-muted-foreground">
            Add descriptive titles to your links for better organization. If you
            don&apos;t provide a title, Shortn will automatically fetch the
            title from the destination page.
          </p>
          {/* [SCREENSHOT: Link title field and automatic title fetching] */}
          <p className="text-muted-foreground">
            Titles are only visible to you in your dashboard and help you
            quickly identify links in lists and reports.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Tags</h2>
          <p className="text-muted-foreground">
            Tags help you organize and filter your links. You can:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>Add multiple tags to a single link</li>
            <li>Create tags on-the-fly while creating links</li>
            <li>Filter your links by tags in the links dashboard</li>
            <li>Manage all tags from the tags section</li>
          </ul>
          {/* [SCREENSHOT: Tag selector with multiple tags applied] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Password Protection</h2>
          <p className="text-muted-foreground">
            Pro users can protect links with passwords. This is useful for:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>Private content or resources</li>
            <li>Event-specific links</li>
            <li>Members-only content</li>
            <li>Controlled access to sensitive information</li>
          </ul>
          {/* [SCREENSHOT: Password protection fields with hint] */}
          <p className="text-muted-foreground mt-4">
            When password protection is enabled:
          </p>
          <ol className="list-decimal pl-6 space-y-2 text-muted-foreground">
            <li>Visitors are shown a password entry page</li>
            <li>Optional hint text can help authorized users</li>
            <li>Rate limiting prevents brute force attempts</li>
            <li>
              Passwords are securely hashed and never stored in plain text
            </li>
          </ol>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Best Practices</h2>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>Use descriptive titles for better organization</li>
            <li>Apply consistent tags across campaigns</li>
            <li>Keep custom back-halves short and memorable</li>
            <li>Test password-protected links before sharing</li>
            <li>Review your monthly link quota in your plan</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">What&apos;s Next?</h2>
          <div className="grid gap-3 mt-4">
            <Button
              asChild
              variant="outline"
              className="justify-between h-auto p-4"
            >
              <Link href="/help/articles/links/managing-links">
                <span>Managing and editing links</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="justify-between h-auto p-4"
            >
              <Link href="/help/articles/links/utm-parameters">
                <span>Using UTM parameters</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>
        </section>
      </article>

      <Separator />

      <div className="w-full flex justify-between items-center">
        <Button asChild variant="ghost">
          <Link href="/help">
            <ArrowLeft className="w-4 h-4" />
            Back to Help
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/help/articles/links/managing-links">
            Next: Managing Links
            <ArrowRight className="w-4 h-4" />
          </Link>
        </Button>
      </div>
    </main>
  );
}
