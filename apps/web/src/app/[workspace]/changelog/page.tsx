import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { ChangelogTag } from "@/components/changelog/changelog-tag";
import { MarkChangelogSeen } from "@/components/changelog/mark-seen";
import { Page } from "@/components/page/page";
import { changelog, itemTag } from "@/lib/changelog/entries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("changelog");
  return { title: t("title") };
}

export default async function ChangelogPage() {
  const [t, format] = await Promise.all([
    getTranslations("changelog"),
    getFormatter(),
  ]);
  return (
    <Page
      crumbs={[{ label: t("title") }]}
      title={t("title")}
      description={t("description")}
    >
      <MarkChangelogSeen />
      <div className="flex flex-col gap-12">
        {changelog.map((entry) => (
          <article
            key={entry.id}
            aria-labelledby={`${entry.id}-title`}
            className="grid gap-x-10 gap-y-2 border-b border-line pb-12 last:border-b-0 last:pb-0 lg:grid-cols-[11rem_minmax(0,1fr)]"
          >
            <div>
              <time
                dateTime={entry.date}
                className="block font-mono text-small text-fg-muted tabular-nums lg:sticky lg:top-16 lg:pt-1"
              >
                {format.dateTime(new Date(`${entry.date}T00:00:00Z`), {
                  dateStyle: "long",
                  timeZone: "UTC",
                })}
              </time>
            </div>
            <div className="max-w-[46rem] min-w-0">
              <h2
                id={`${entry.id}-title`}
                className="text-title font-semibold tracking-[-0.015em]"
              >
                {t(`entries.${entry.id}.title`)}
              </h2>
              <p className="mt-2 max-w-[65ch] text-body text-pretty text-fg-muted">
                {t(`entries.${entry.id}.summary`)}
              </p>
              <nav aria-label={t("contents")} className="mt-5">
                <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-small">
                  {entry.sections.map((section) => (
                    <li key={section.id}>
                      <a
                        href={`#${entry.id}-${section.id}`}
                        className="rounded-chip text-fg-muted underline-offset-4 hover:text-fg hover:underline"
                      >
                        {t(`entries.${entry.id}.sections.${section.id}`)}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
              {entry.sections.map((section) => (
                <section
                  key={section.id}
                  id={`${entry.id}-${section.id}`}
                  aria-labelledby={`${entry.id}-${section.id}-title`}
                  className="mt-10 scroll-mt-16 border-t border-line pt-6"
                >
                  <h3
                    id={`${entry.id}-${section.id}-title`}
                    className="text-body font-semibold"
                  >
                    {t(`entries.${entry.id}.sections.${section.id}`)}
                  </h3>
                  <ul className="mt-4 grid gap-x-10 gap-y-5 sm:grid-cols-2">
                    {section.items.map((item) => {
                      const tag = itemTag(item);
                      return (
                        <li key={item.id} className="min-w-0">
                          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-small font-medium text-pretty text-fg">
                            {t(`entries.${entry.id}.items.${item.id}.title`)}
                            {tag ? <ChangelogTag tag={tag} /> : null}
                          </p>
                          <p className="mt-1 text-small text-pretty text-fg-muted">
                            {t(`entries.${entry.id}.items.${item.id}.body`)}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          </article>
        ))}
      </div>
    </Page>
  );
}
