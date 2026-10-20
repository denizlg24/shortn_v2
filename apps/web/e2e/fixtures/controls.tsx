"use client";

import { TimeSeriesChart } from "@shortn/ui";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { UtmForm } from "@/components/link-pages/utm-form";
import { DeleteUtm } from "@/components/link-pages/delete-utm";
import { TagsField } from "@/components/page/tags-field";
import { ShareButton } from "@/components/page/share-button";
import { FilterBar, FilterCombobox } from "@/components/page/filters";
import { QrFilters } from "@/components/qr/qr-filters";

const tags = [
  "Editorial",
  "Newsletter",
  "Print",
  ...Array.from({ length: 60 }, (_, i) => `Campaign ${i + 1}`),
];
const points = Array.from({ length: 30 }, (_, i) => ({
  date: new Date(Date.UTC(2026, 8, i + 1)).toISOString(),
  value: (i % 7) * 1234,
}));

/** Mounted only by controls.browser.ts, then removed from the route tree. */
export default function ControlsFixture() {
  const t = useTranslations("linkPages.form");
  const [posted, setPosted] = useState<string[]>([]);
  useEffect(() => {
    document.documentElement.dataset.controlsReady = "true";
    return () => {
      delete document.documentElement.dataset.controlsReady;
    };
  }, []);
  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="mb-6 text-title">P4 browser controls fixture</h1>
      <section aria-label="Choice filters">
        <FilterBar applied={[]}>
          <FilterCombobox
            label="Country"
            name="country"
            allLabel="Any country"
            options={[
              { value: "", label: "Any country" },
              { value: "dk", label: "Denmark" },
              { value: "dk", label: "Duplicate Denmark" },
              { value: "pt", label: "Portugal" },
            ]}
          />
        </FilterBar>
      </section>
      <section aria-label="QR filters">
        <QrFilters tags={tags} />
      </section>
      <form
        aria-label="Tags form"
        onSubmit={(event) => {
          event.preventDefault();
          setPosted(
            new FormData(event.currentTarget).getAll("tag") as string[],
          );
        }}
      >
        <TagsField
          id="tags"
          label={t("tagsSection")}
          allTags={tags}
          selected={["Editorial"]}
        />
        <button className="my-4" type="submit">
          Submit tags
        </button>
        <output data-testid="posted-tags" className="block break-all">
          {JSON.stringify(posted)}
        </output>
      </form>
      <ShareButton
        url="https://shortn.at/p4-browser-check"
        title="P4 fixture"
      />
      <section aria-label="UTM edit" className="mt-6">
        <UtmForm
          initial={{
            source: "newsletter",
            medium: "email",
            campaign: "Autumn",
            term: "",
            content: "",
          }}
          campaigns={[
            {
              title: "Autumn",
              utmDefaults: {
                sources: ["newsletter", "partner"],
                mediums: ["email"],
                terms: [],
                contents: ["header"],
              },
            },
            {
              title: "Winter",
              utmDefaults: {
                sources: ["winter-news"],
                mediums: [],
                terms: [],
                contents: [],
              },
            },
          ]}
          action={async () => ({ error: "conflict" })}
          cancelHref="?returned=utm"
        />
      </section>
      <section aria-label="UTM confirmation" className="mt-6">
        <DeleteUtm
          variant={{
            source: "newsletter",
            medium: "email",
            campaign: "Autumn",
          }}
          action={async () => ({ error: "conflict" })}
          cancelHref="?returned=utm"
        />
      </section>
      <section aria-label="Activity" className="mt-6 min-w-0">
        <TimeSeriesChart
          data={points}
          seriesLabel="Activity"
          interval="day"
          height={220}
        />
      </section>
    </main>
  );
}
