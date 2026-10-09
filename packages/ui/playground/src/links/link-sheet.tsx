import {
  BarList,
  Button,
  Combobox,
  Destination,
  Field,
  formatDate,
  formatNumber,
  Input,
  qrSvgMarkup,
  QRPreview,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  ShortLink,
  shortUrl,
  StatStrip,
  Switch,
  TagChips,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  TimeSeriesChart,
  Tooltip,
  useUILocale,
  type LinkRow,
} from "@shortn/ui";
import { Download, ExternalLink, Lock } from "lucide-react";
import { useId, useMemo, useState, type ReactNode } from "react";
import { usePlayground } from "../app-context";
import { getLinkDetails, type ActivityEntry } from "../data/details";
import { DEMO_DOMAIN } from "../data/links";

export type SheetTab = "overview" | "edit" | "qr" | "activity";

export interface LinkDraft {
  url: string;
  key: string;
  tags: string[];
  campaign: string;
  interstitial: boolean;
}

interface LinkSheetProps {
  link: LinkRow | null;
  /** Present when creating from the composer's "More options". */
  createDraft: LinkDraft | null;
  tab: SheetTab;
  onTabChange: (tab: SheetTab) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit: boolean;
  allTags: string[];
  onSave: (draft: LinkDraft) => string | null;
}

const CAMPAIGNS = [
  "matinal-outubro",
  "conferencia-pme-2026",
  "assinaturas-outono",
  "orcamento-2027",
];

export function LinkSheet({
  link,
  createDraft,
  tab,
  onTabChange,
  open,
  onOpenChange,
  canEdit,
  allTags,
  onSave,
}: LinkSheetProps) {
  const { copy } = usePlayground();
  const creating = createDraft !== null;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent {...(creating ? { "aria-describedby": undefined } : {})}>
        {creating ? (
          <>
            <SheetHeader>
              <SheetTitle>{copy.composer.label}</SheetTitle>
            </SheetHeader>
            <EditForm
              key="create"
              initial={createDraft}
              canEdit={canEdit}
              allTags={allTags}
              submitLabel={copy.links.create}
              onCancel={() => onOpenChange(false)}
              onSave={onSave}
            />
          </>
        ) : link ? (
          <>
            <SheetHeader>
              <SheetTitle className="sr-only">{`${link.domain}/${link.key}`}</SheetTitle>
              <ShortLink
                domain={link.domain}
                linkKey={link.key}
                size="lg"
                className="max-w-full self-start"
              />
              <SheetDescription asChild>
                <div className="flex min-w-0 items-center gap-1">
                  <Destination
                    url={link.url}
                    faviconSrc={link.faviconSrc}
                    className="min-w-0 flex-1"
                  />
                  <Tooltip content={copy.sheet.openDestination}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      aria-label={copy.sheet.openDestination}
                      className="grid size-7 shrink-0 place-items-center rounded-control text-fg-subtle hover:bg-bg-muted hover:text-fg"
                    >
                      <ExternalLink aria-hidden className="size-4" />
                    </a>
                  </Tooltip>
                </div>
              </SheetDescription>
            </SheetHeader>
            <Tabs
              value={tab}
              onValueChange={(value) => onTabChange(value as SheetTab)}
              className="flex min-h-0 flex-1 flex-col"
            >
              <TabsList className="px-6 max-md:px-4">
                <TabsTrigger value="overview">
                  {copy.sheet.overview}
                </TabsTrigger>
                <TabsTrigger value="edit">{copy.sheet.edit}</TabsTrigger>
                <TabsTrigger value="qr">{copy.sheet.qr}</TabsTrigger>
                <TabsTrigger value="activity">
                  {copy.sheet.activity}
                </TabsTrigger>
              </TabsList>
              <TabsContent
                value="overview"
                className="min-h-0 flex-1 data-[state=active]:flex data-[state=active]:flex-col"
              >
                <SheetBody className="pt-5">
                  <Overview link={link} />
                </SheetBody>
              </TabsContent>
              <TabsContent
                value="edit"
                className="min-h-0 flex-1 data-[state=active]:flex data-[state=active]:flex-col"
              >
                <EditForm
                  key={link.id}
                  initial={{
                    url: link.url,
                    key: link.key,
                    tags: link.tags,
                    campaign: "",
                    interstitial: false,
                  }}
                  canEdit={canEdit}
                  allTags={allTags}
                  submitLabel={copy.sheet.save}
                  onCancel={() => onTabChange("overview")}
                  onSave={onSave}
                />
              </TabsContent>
              <TabsContent
                value="qr"
                className="min-h-0 flex-1 data-[state=active]:flex data-[state=active]:flex-col"
              >
                <SheetBody className="pt-6">
                  <QrPanel link={link} />
                </SheetBody>
              </TabsContent>
              <TabsContent
                value="activity"
                className="min-h-0 flex-1 data-[state=active]:flex data-[state=active]:flex-col"
              >
                <SheetBody className="pt-5">
                  <Activity link={link} />
                </SheetBody>
              </TabsContent>
            </Tabs>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function SectionHeading({ children }: { children: ReactNode }) {
  return <h3 className="mb-2 text-small font-medium text-fg">{children}</h3>;
}

function Overview({ link }: { link: LinkRow }) {
  const { copy } = usePlayground();
  const { intlLocale } = useUILocale();
  const details = useMemo(
    () => getLinkDetails(link, intlLocale, copy.referrers),
    [link, intlLocale, copy.referrers],
  );
  const delta =
    details.previous30 > 0
      ? details.last30 / details.previous30 - 1
      : undefined;
  const topCountry = details.countries[0]?.label ?? "—";
  const topReferrer = details.referrers[0]?.label ?? "—";

  return (
    <div className="flex flex-col gap-7">
      <StatStrip
        stats={[
          {
            label: copy.sheet.clicks30,
            value: formatNumber(details.last30, intlLocale),
            ...(delta === undefined ? {} : { delta }),
          },
          {
            label: copy.sheet.allTime,
            value: formatNumber(link.clicks, intlLocale),
          },
          {
            label: copy.sheet.topCountry,
            value: <span className="text-body font-medium">{topCountry}</span>,
          },
          {
            label: copy.sheet.topReferrer,
            value: <span className="text-body font-medium">{topReferrer}</span>,
          },
        ]}
      />
      <section aria-label={copy.sheet.clicks30}>
        {details.last30 === 0 ? (
          <p className="border-y border-line py-10 text-center text-small text-fg-muted">
            {copy.sheet.noData}
          </p>
        ) : (
          <TimeSeriesChart
            data={details.series}
            seriesLabel={copy.sheet.clicks}
            height={176}
          />
        )}
      </section>
      {details.last30 > 0 ? (
        <div className="grid gap-x-8 gap-y-6 border-t border-line pt-5 sm:grid-cols-2">
          <section>
            <SectionHeading>{copy.sheet.countries}</SectionHeading>
            <BarList label={copy.sheet.countries} items={details.countries} />
          </section>
          <section>
            <SectionHeading>{copy.sheet.referrers}</SectionHeading>
            <BarList label={copy.sheet.referrers} items={details.referrers} />
          </section>
        </div>
      ) : null}
      <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2.5 border-t border-line pt-5 text-small">
        <dt className="text-fg-muted">{copy.sheet.createdBy}</dt>
        <dd>{link.createdBy ?? "API"}</dd>
        <dt className="text-fg-muted">{copy.sheet.createdOn}</dt>
        <dd className="font-mono tabular-nums">
          {formatDate(new Date(link.createdAt), intlLocale, true)}
        </dd>
        <dt className="text-fg-muted">{copy.sheet.tags}</dt>
        <dd className="min-w-0">
          {link.tags.length > 0 ? (
            <TagChips tags={link.tags} max={12} className="flex-wrap" />
          ) : (
            "—"
          )}
        </dd>
      </dl>
    </div>
  );
}

function EditForm({
  initial,
  canEdit,
  allTags,
  submitLabel,
  onCancel,
  onSave,
}: {
  initial: LinkDraft;
  canEdit: boolean;
  allTags: string[];
  submitLabel: string;
  onCancel: () => void;
  onSave: (draft: LinkDraft) => string | null;
}) {
  const { copy } = usePlayground();
  const [draft, setDraft] = useState(initial);
  const [extraTags, setExtraTags] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const tagOptions = [
    ...new Set([...allTags, ...extraTags, ...draft.tags]),
  ].map((tag) => ({ value: tag, label: tag }));
  const disabled = !canEdit;

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        setError(onSave(draft));
      }}
    >
      <SheetBody className="flex flex-col gap-5 pt-5">
        {disabled ? (
          <p className="flex items-start gap-2 text-small text-fg-muted">
            <Lock aria-hidden className="mt-0.5 size-4 shrink-0" />
            {copy.sheet.readOnly}
          </p>
        ) : null}
        <Field
          label={copy.sheet.destination}
          htmlFor={`${id}-url`}
          {...(error ? { error } : {})}
        >
          <Input
            id={`${id}-url`}
            type="url"
            value={draft.url}
            disabled={disabled}
            aria-invalid={Boolean(error) || undefined}
            onChange={(event) => {
              setDraft({ ...draft, url: event.target.value });
              setError(null);
            }}
            className="truncate"
          />
        </Field>
        <Field label={copy.sheet.key} htmlFor={`${id}-key`}>
          <Input
            id={`${id}-key`}
            value={draft.key}
            maxLength={64}
            disabled={disabled}
            leading={
              <span className="text-small text-fg-subtle">{DEMO_DOMAIN}/</span>
            }
            frameClassName="gap-0"
            onChange={(event) => {
              setDraft({
                ...draft,
                key: event.target.value.replace(/\s+/g, "-"),
              });
              setError(null);
            }}
          />
        </Field>
        <Field label={copy.sheet.tags} htmlFor={`${id}-tags`}>
          <Combobox
            id={`${id}-tags`}
            multiple
            disabled={disabled}
            options={tagOptions}
            value={draft.tags}
            onValueChange={(tags) => setDraft({ ...draft, tags })}
            placeholder={copy.sheet.tags}
            searchPlaceholder={copy.bulk.tagSearch}
            emptyText={copy.bulk.noTags}
            createLabel={copy.bulk.createTag}
            onCreate={(tag) => {
              setExtraTags((current) => [...current, tag]);
              setDraft({ ...draft, tags: [...draft.tags, tag] });
            }}
          />
        </Field>
        <Field label={copy.sheet.campaign} htmlFor={`${id}-campaign`}>
          <Select
            value={draft.campaign || "none"}
            onValueChange={(campaign) =>
              setDraft({
                ...draft,
                campaign: campaign === "none" ? "" : campaign,
              })
            }
            disabled={disabled}
          >
            <SelectTrigger id={`${id}-campaign`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{copy.sheet.noCampaign}</SelectItem>
              {CAMPAIGNS.map((campaign) => (
                <SelectItem key={campaign} value={campaign}>
                  {campaign}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="flex items-start justify-between gap-6 border-t border-line pt-5">
          <label
            htmlFor={`${id}-interstitial`}
            className="flex flex-col gap-0.5"
          >
            <span className="text-small font-medium">
              {copy.sheet.interstitial}
            </span>
            <span className="text-meta text-fg-muted">
              {copy.sheet.interstitialHint}
            </span>
          </label>
          <Switch
            id={`${id}-interstitial`}
            checked={draft.interstitial}
            disabled={disabled}
            onCheckedChange={(interstitial) =>
              setDraft({ ...draft, interstitial })
            }
            className="mt-0.5"
          />
        </div>
      </SheetBody>
      <SheetFooter>
        <Button variant="ghost" onClick={onCancel}>
          {copy.sheet.discard}
        </Button>
        <Button
          variant="primary"
          type="submit"
          {...(disabled ? { disabledReason: copy.links.viewerReason } : {})}
        >
          {submitLabel}
        </Button>
      </SheetFooter>
    </form>
  );
}

function QrPanel({ link }: { link: LinkRow }) {
  const { copy } = usePlayground();
  const url = shortUrl(link.domain, link.key);
  const download = () => {
    const blob = new Blob([qrSvgMarkup(url)], { type: "image/svg+xml" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `${link.key}.svg`;
    anchor.click();
    URL.revokeObjectURL(href);
  };
  return (
    <div className="flex flex-col items-start gap-5 sm:flex-row">
      <QRPreview
        value={url}
        size={176}
        label={`QR: ${link.domain}/${link.key}`}
        className="ring-1 ring-line"
      />
      <div className="flex max-w-72 flex-col gap-3">
        <p className="text-small text-pretty text-fg-muted">
          {copy.sheet.qrHint}
        </p>
        <Button onClick={download} className="self-start">
          <Download aria-hidden />
          {copy.sheet.downloadSvg}
        </Button>
      </div>
    </div>
  );
}

function Activity({ link }: { link: LinkRow }) {
  const { copy } = usePlayground();
  const { intlLocale } = useUILocale();
  const details = useMemo(
    () => getLinkDetails(link, intlLocale, copy.referrers),
    [link, intlLocale, copy.referrers],
  );
  const describe = (entry: ActivityEntry) => {
    switch (entry.kind) {
      case "created":
        return copy.sheet.activityCreated;
      case "destination":
        return copy.sheet.activityDestination;
      case "tag":
        return copy.sheet.activityTag(entry.detail ?? "");
      case "qr":
        return copy.sheet.activityQr;
      case "export":
        return copy.sheet.activityExport;
    }
  };
  return (
    <ol className="flex flex-col">
      {details.activity.map((entry) => (
        <li
          key={entry.id}
          className="flex items-start gap-3 border-b border-line py-3 last:border-b-0"
        >
          <span
            aria-hidden
            className="mt-px grid size-6 shrink-0 place-items-center rounded-full bg-fg/8 text-[10px] font-semibold text-fg-muted"
          >
            {entry.actor
              .split(" ")
              .map((part) => part[0])
              .join("")
              .slice(0, 2)}
          </span>
          <p className="min-w-0 flex-1 text-small text-pretty">
            <span className="font-medium">{entry.actor}</span>{" "}
            <span className="text-fg-muted">{describe(entry)}</span>
          </p>
          <time
            dateTime={entry.at}
            className="shrink-0 font-mono text-meta text-fg-subtle tabular-nums"
          >
            {formatDate(new Date(entry.at), intlLocale)}
          </time>
        </li>
      ))}
    </ol>
  );
}
