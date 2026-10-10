import {
  BarList,
  Button,
  Checkbox,
  Combobox,
  Destination,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  Field,
  FilterBar,
  Input,
  KeyboardHint,
  Popover,
  PopoverContent,
  PopoverTrigger,
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
  SheetTrigger,
  ShortLink,
  ShortnMark,
  Skeleton,
  Sparkline,
  StatStrip,
  Switch,
  TagChips,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  TimeSeriesChart,
  toast,
  Tooltip,
  UsageMeter,
  type FilterValue,
} from "@shortn/ui";
import {
  Archive,
  Copy,
  Menu,
  Pencil,
  Plus,
  Search,
  Settings2,
  Trash,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { usePlayground, type DemoState } from "../app-context";
import { generateLinks } from "../data/links";
import { ThemeLocaleQuick } from "../shell/sidebar";

const COLOR_TOKENS: Array<[token: string, role: string]> = [
  ["bg", "Page"],
  ["bg-subtle", "Sidebar, table header, hovered row"],
  ["bg-muted", "Selected row"],
  ["line", "Hairlines"],
  ["line-strong", "Input borders"],
  ["fg", "Primary text (brand navy)"],
  ["fg-muted", "Secondary text"],
  ["fg-subtle", "Placeholder, meta"],
  ["primary", "Primary fill"],
  ["signal", "Focus, links, series 1"],
  ["success", "Status only"],
  ["warning", "Status only"],
  ["danger", "Status only"],
];

const TYPE_SCALE: Array<[className: string, label: string]> = [
  ["text-meta", "Meta · 12/16"],
  ["text-small", "Table, body-sm · 13/18"],
  ["text-body", "Body · 14/20"],
  ["text-emphasis", "Emphasis · 16/24"],
  ["text-title font-semibold tracking-[-0.015em]", "Page title · 20/28"],
];

const SERIES = [
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
  "chart-6",
];

export function GalleryPage({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  const { copy, navigate, setPaletteOpen } = usePlayground();
  const sample = useMemo(() => generateLinks(), []);
  const longKey = sample.find((link) => link.key.length > 48) ?? sample[0];
  const longUrl = sample.find((link) => link.url.length > 1500) ?? sample[0];
  const manyTags = sample.find((link) => link.tags.length > 20) ?? sample[0];
  const busy = [...sample].sort((a, b) => b.clicks - a.clicks)[0] ?? sample[0];
  const [tags, setTags] = useState<string[]>(["newsletter", "print"]);
  const [filters, setFilters] = useState<FilterValue>({ tag: ["newsletter"] });
  const [checked, setChecked] = useState(true);
  const [switchOn, setSwitchOn] = useState(true);
  const [today] = useState(() => Date.now());

  if (!longKey || !longUrl || !manyTags || !busy) return null;

  const states: Array<[DemoState, string]> = [
    ["ready", copy.palette.stateReady],
    ["empty", copy.palette.stateEmpty],
    ["loading", copy.palette.stateLoading],
    ["error", copy.palette.stateError],
    ["readonly", copy.palette.stateReadonly],
    ["long", copy.palette.stateLong],
  ];

  return (
    <>
      <header className="flex min-h-page-header shrink-0 flex-wrap items-center gap-3 border-b border-line px-gutter py-2.5">
        <Button
          variant="ghost"
          size="icon-md"
          className="-ml-2 md:hidden"
          aria-label={copy.nav.openMenu}
          onClick={onOpenDrawer}
        >
          <Menu aria-hidden />
        </Button>
        <h1 className="text-title font-semibold tracking-[-0.015em]">
          {copy.gallery.title}
        </h1>
        <div className="ml-auto">
          <ThemeLocaleQuick />
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-[960px] flex-col px-gutter pb-24">
          <p className="max-w-[60ch] pt-6 text-body text-pretty text-fg-muted">
            {copy.gallery.intro}
          </p>

          <Section
            title="States"
            description="Every Links page state, reachable from ⌘K too."
          >
            <div className="flex flex-wrap gap-2">
              {states.map(([state, label]) => (
                <Button key={state} onClick={() => navigate("links", state)}>
                  {label}
                </Button>
              ))}
            </div>
          </Section>

          <Section
            title="Colour"
            description="OKLCH tokens. Neutrals carry the brand hue. Chart series are checked for colour-vision-deficiency separation in both themes."
          >
            <ul className="grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
              {COLOR_TOKENS.map(([token, role]) => (
                <li key={token} className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="size-6 shrink-0 rounded-chip ring-1 ring-line ring-inset"
                    style={{ background: `var(--${token})` }}
                  />
                  <code className="w-24 shrink-0 text-meta text-fg">
                    --{token}
                  </code>
                  <span className="truncate text-small text-fg-muted">
                    {role}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              {SERIES.map((series, index) => (
                <span
                  key={series}
                  className="inline-flex items-center gap-1.5 text-meta text-fg-muted"
                >
                  <span
                    aria-hidden
                    className="h-1.5 w-6 rounded-full"
                    style={{ background: `var(--${series})` }}
                  />
                  Series {index + 1}
                </span>
              ))}
            </div>
          </Section>

          <Section
            title="Type"
            description="Geist for UI, Geist Mono with tabular figures for data."
          >
            <div className="flex flex-col gap-3">
              {TYPE_SCALE.map(([className, label]) => (
                <div
                  key={label}
                  className="flex items-baseline gap-6 border-b border-line pb-3 last:border-b-0"
                >
                  <span className="w-44 shrink-0 text-meta text-fg-subtle">
                    {label}
                  </span>
                  <span className={className}>
                    Exportações portuguesas batem recorde em agosto
                  </span>
                </div>
              ))}
              <div className="flex items-baseline gap-6">
                <span className="w-44 shrink-0 text-meta text-fg-subtle">
                  Figures · mono 13
                </span>
                <span className="font-mono text-small tabular-nums">
                  1,284 · 12,480 · 248,913 · 3d · 5w
                </span>
              </div>
            </div>
          </Section>

          <Section
            title="Button"
            description="Primary, secondary, ghost, danger at 28 / 32 / 36. Disabled-with-reason stays focusable and explains itself."
          >
            <Row label="Variants">
              <Button variant="primary" shortcut="c">
                <Plus aria-hidden />
                Create link
              </Button>
              <Button>Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Delete 3 links</Button>
              <Button variant="dangerGhost">
                <Trash aria-hidden />
                Delete
              </Button>
            </Row>
            <Row label="Sizes">
              <Button size="sm">Small 28</Button>
              <Button size="md">Medium 32</Button>
              <Button size="lg">Large 36</Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Settings"
                tooltip="Settings"
              >
                <Settings2 aria-hidden />
              </Button>
              <Button
                size="icon-md"
                aria-label="Copy"
                tooltip="Copy short link"
                shortcut={["mod", "c"]}
              >
                <Copy aria-hidden />
              </Button>
            </Row>
            <Row label="States">
              <Button variant="primary" loading>
                Saving
              </Button>
              <Button
                variant="primary"
                disabledReason="Viewers can't create links. Ask a workspace admin for Editor access."
              >
                Create link
              </Button>
              <Button disabled>Disabled</Button>
            </Row>
          </Section>

          <Section
            title="Form controls"
            description="One field vocabulary: 32px, 6px radius, signal focus ring, inline errors that name the fix."
          >
            <div className="grid max-w-[560px] gap-5">
              <Field
                label="Destination URL"
                htmlFor="g-url"
                hint="Paste the full article address."
              >
                <Input
                  id="g-url"
                  leading={<Search aria-hidden />}
                  placeholder="https://gazetaexemplo.pt/…"
                />
              </Field>
              <Field
                label="Short link"
                htmlFor="g-key"
                error="shortn.at/irs-jovem is taken. Try irs-jovem-2."
              >
                <Input
                  id="g-key"
                  aria-invalid
                  defaultValue="irs-jovem"
                  leading={<span className="text-fg-subtle">shortn.at/</span>}
                  frameClassName="gap-0"
                />
              </Field>
              <Field label="Disabled" htmlFor="g-disabled">
                <Input
                  id="g-disabled"
                  disabled
                  defaultValue="Locked by a workspace admin"
                />
              </Field>
              <Field label="Notes" htmlFor="g-notes">
                <Textarea
                  id="g-notes"
                  placeholder="Internal note for the newsletter team"
                />
              </Field>
              <Field label="Campaign" htmlFor="g-campaign">
                <Select defaultValue="matinal-outubro">
                  <SelectTrigger id="g-campaign">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="matinal-outubro">
                      matinal-outubro
                    </SelectItem>
                    <SelectItem value="conferencia-pme-2026">
                      conferencia-pme-2026
                    </SelectItem>
                    <SelectItem value="assinaturas-outono">
                      assinaturas-outono
                    </SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Tags" htmlFor="g-tags">
                <Combobox
                  id="g-tags"
                  multiple
                  options={[
                    "newsletter",
                    "print",
                    "linkedin",
                    "facebook",
                    "podcast",
                    "eventos",
                    "assinaturas",
                  ].map((tag) => ({ value: tag, label: tag }))}
                  value={tags}
                  onValueChange={setTags}
                  placeholder="Add tags"
                  searchPlaceholder="Find or create a tag"
                  emptyText="No tags found"
                  createLabel={(query) => `Create tag “${query}”`}
                  onCreate={(tag) => setTags([...tags, tag])}
                />
              </Field>
              <div className="flex flex-wrap items-center gap-6">
                <label className="flex items-center gap-2 text-small">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(value) => setChecked(value === true)}
                  />
                  Checked
                </label>
                <label className="flex items-center gap-2 text-small">
                  <Checkbox checked="indeterminate" />
                  Indeterminate
                </label>
                <label className="flex items-center gap-2 text-small text-fg-muted">
                  <Checkbox disabled />
                  Disabled
                </label>
                <label className="flex items-center gap-2 text-small">
                  <Switch checked={switchOn} onCheckedChange={setSwitchOn} />
                  Ask before redirecting
                </label>
              </div>
            </div>
          </Section>

          <Section
            title="Tabs"
            description="Underline tabs; the active indicator uses the primary ink."
          >
            <Tabs defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="edit">Edit</TabsTrigger>
                <TabsTrigger value="qr">QR code</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
              </TabsList>
              <TabsContent
                value="overview"
                className="pt-4 text-small text-fg-muted"
              >
                Overview content.
              </TabsContent>
              <TabsContent
                value="edit"
                className="pt-4 text-small text-fg-muted"
              >
                Edit content.
              </TabsContent>
              <TabsContent value="qr" className="pt-4 text-small text-fg-muted">
                QR content.
              </TabsContent>
              <TabsContent
                value="activity"
                className="pt-4 text-small text-fg-muted"
              >
                Activity content.
              </TabsContent>
            </Tabs>
          </Section>

          <Section
            title="Overlays"
            description="The only elevated surfaces. Dialogs are reserved for destructive confirmation; everything else is a sheet, menu or inline."
          >
            <Row label="Menus">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button>Row actions</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56">
                  <DropdownMenuLabel>shortn.at/irs-jovem</DropdownMenuLabel>
                  <DropdownMenuItem icon={<Pencil aria-hidden />} shortcut="e">
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    icon={<Copy aria-hidden />}
                    shortcut={["mod", "c"]}
                  >
                    Copy short link
                  </DropdownMenuItem>
                  <DropdownMenuCheckboxItem checked>
                    Show in campaign
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem icon={<Archive aria-hidden />}>
                    Archive
                  </DropdownMenuItem>
                  <DropdownMenuItem icon={<Trash aria-hidden />} tone="danger">
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Popover>
                <PopoverTrigger asChild>
                  <Button>Popover</Button>
                </PopoverTrigger>
                <PopoverContent>
                  <p className="font-medium">UTM defaults</p>
                  <p className="mt-1 text-fg-muted">
                    utm_source=newsletter · utm_medium=email
                  </p>
                </PopoverContent>
              </Popover>
              <Tooltip content="Create link" shortcut="c">
                <Button variant="ghost">Tooltip with hint</Button>
              </Tooltip>
            </Row>
            <Row label="Panels">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="danger">Delete 3 links</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader
                    title={copy.dialog.deleteTitle(3)}
                    description={copy.dialog.deleteBody}
                  />
                  <DialogFooter>
                    <Button variant="ghost">{copy.dialog.cancel}</Button>
                    <Button variant="danger">{copy.dialog.confirm(3)}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Sheet>
                <SheetTrigger asChild>
                  <Button>Open sheet</Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Sheet</SheetTitle>
                    <SheetDescription>
                      Right side, 480–640px; full screen below 768px.
                    </SheetDescription>
                  </SheetHeader>
                  <SheetBody>
                    <p className="text-small text-fg-muted">
                      Long-form editing lives here instead of a modal.
                    </p>
                  </SheetBody>
                  <SheetFooter>
                    <Button variant="primary">Save changes</Button>
                  </SheetFooter>
                </SheetContent>
              </Sheet>
              <Button onClick={() => setPaletteOpen(true)}>
                Command palette{" "}
                <KeyboardHint keys={["mod", "k"]} className="ml-1" />
              </Button>
            </Row>
            <Row label="Toasts">
              <Button
                onClick={() =>
                  toast("3 links archived", {
                    action: { label: "Undo", onClick: () => {} },
                  })
                }
              >
                Undo toast
              </Button>
              <Button
                onClick={() =>
                  toast("Export ready", {
                    description: "links-export.csv · 200 rows",
                    action: { label: "Download", onClick: () => {} },
                  })
                }
              >
                Background result
              </Button>
              <Button
                onClick={() =>
                  toast.error("Export failed", {
                    description:
                      "The export service timed out. Try again in a minute.",
                  })
                }
              >
                Error
              </Button>
            </Row>
          </Section>

          <Section
            title="Short link and destination"
            description="Muted domain, emphasized key, copy on click with a check that draws itself. Destinations truncate in the middle so the slug end stays visible."
          >
            <div className="flex flex-col gap-3">
              <ShortLink domain="shortn.at" linkKey="irs-jovem" />
              <ShortLink
                domain="shortn.at"
                linkKey="conferencia-pme"
                size="lg"
              />
              <div className="max-w-[360px]">
                <ShortLink
                  domain="shortn.at"
                  linkKey={longKey.key}
                  className="max-w-full"
                />
              </div>
              <div className="max-w-[420px]">
                <Destination url={busy.url} faviconSrc={busy.faviconSrc} />
              </div>
              <div className="max-w-[420px]">
                <Destination
                  url={longUrl.url}
                  faviconSrc={longUrl.faviconSrc}
                />
              </div>
            </div>
          </Section>

          <Section title="Tags, sparklines, figures">
            <div className="flex flex-col gap-4">
              <TagChips tags={["newsletter", "print"]} />
              <TagChips
                tags={[
                  "newsletter",
                  "linkedin",
                  "eventos",
                  "assinaturas",
                  "parceiros",
                  "video",
                ]}
                max={3}
              />
              <div className="max-w-[240px]">
                <TagChips tags={manyTags.tags} max={2} />
              </div>
              <div className="flex items-center gap-6 text-fg-muted">
                <Sparkline data={busy.trend} label="30-day clicks" />
                <Sparkline
                  data={[
                    0, 0, 2, 5, 9, 14, 30, 41, 38, 52, 60, 58, 71, 80, 77, 92,
                    104, 99, 120, 131, 128, 140, 152, 149, 160, 171, 169, 182,
                    190, 204,
                  ]}
                />
                <Sparkline
                  data={[
                    220, 180, 160, 140, 120, 90, 80, 70, 60, 55, 40, 35, 30, 28,
                    22, 20, 18, 15, 12, 10, 9, 8, 6, 5, 4, 3, 2, 2, 1, 1,
                  ]}
                />
                <Sparkline data={Array.from({ length: 30 }, () => 0)} />
              </div>
            </div>
          </Section>

          <Section
            title="Stat strip"
            description="One strip with hairline separators, never a card grid."
          >
            <StatStrip
              stats={[
                { label: "Clicks, 30 days", value: "48,210", delta: 0.124 },
                { label: "QR scans", value: "6,932", delta: -0.031 },
                { label: "Unique visitors", value: "31,077", delta: 0 },
                {
                  label: "Top country",
                  value: (
                    <span className="text-body font-medium">Portugal</span>
                  ),
                },
              ]}
            />
          </Section>

          <Section title="Filter bar">
            <FilterBar
              fields={[
                {
                  id: "tag",
                  label: "Tag",
                  options: ["newsletter", "print", "linkedin", "podcast"].map(
                    (tag) => ({ value: tag, label: tag }),
                  ),
                },
                {
                  id: "createdBy",
                  label: "Created by",
                  options: ["Inês Marques", "Rui Carvalho"].map((name) => ({
                    value: name,
                    label: name,
                  })),
                },
              ]}
              value={filters}
              onValueChange={setFilters}
              pickerPlaceholder="Filter by…"
            />
          </Section>

          <Section
            title="Usage meter"
            description="Exact numbers, never a bare percentage."
          >
            <div className="grid max-w-[640px] gap-6 sm:grid-cols-3">
              <UsageMeter
                label="Links"
                used={1_284}
                limit={2_000}
                unit="links"
              />
              <UsageMeter
                label="Clicks this month"
                used={92_410}
                limit={100_000}
                unit="clicks"
                detail="Resets 1 Nov"
              />
              <UsageMeter
                label="Custom domains"
                used={4}
                limit={3}
                unit="domains"
              />
            </div>
          </Section>

          <Section title="Breakdowns and charts">
            <div className="grid gap-8 sm:grid-cols-2">
              <BarList
                label="Countries"
                items={[
                  { id: "pt", label: "Portugal", value: 18_204 },
                  { id: "br", label: "Brasil", value: 3_310 },
                  { id: "es", label: "Espanha", value: 1_802 },
                  { id: "fr", label: "França", value: 1_204 },
                ]}
              />
              <div className="flex items-start gap-5">
                <QRPreview
                  value="https://shortn.at/irs-jovem"
                  label="QR code for shortn.at/irs-jovem"
                  size={120}
                  className="ring-1 ring-line"
                />
                <p className="text-small text-pretty text-fg-muted">
                  QR codes render as crisp vector modules in brand navy on
                  white, in both themes.
                </p>
              </div>
            </div>
            <TimeSeriesChart
              className="mt-6"
              seriesLabel="Clicks"
              data={busy.trend.map((value, index) => ({
                date: new Date(
                  today - (busy.trend.length - 1 - index) * 86_400_000,
                )
                  .toISOString()
                  .slice(0, 10),
                value,
              }))}
            />
          </Section>

          <Section title="Empty, loading, keys">
            <div className="grid gap-8 sm:grid-cols-2">
              <EmptyState
                className="py-6"
                title={copy.empty.firstTitle}
                description={copy.empty.firstBody}
                action={
                  <Button variant="primary" shortcut="c">
                    {copy.links.create}
                  </Button>
                }
              />
              <div className="flex flex-col gap-3 pt-6">
                <Skeleton className="h-3 w-3/5" />
                <Skeleton className="h-3 w-4/5" />
                <Skeleton className="h-3 w-2/5" />
                <div className="flex flex-wrap items-center gap-3 pt-3">
                  <KeyboardHint keys={["mod", "k"]} />
                  <KeyboardHint keys={["g", "l"]} sequence />
                  <KeyboardHint keys={["shift", "x"]} />
                  <KeyboardHint keys="enter" />
                  <KeyboardHint keys="esc" />
                  <ShortnMark size={24} title="Shortn" />
                </div>
              </div>
            </div>
          </Section>
        </div>
      </div>
    </>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-line pt-10 pb-10 last:border-b-0">
      <h2 className="text-emphasis font-semibold tracking-[-0.01em]">
        {title}
      </h2>
      {description ? (
        <p className="mt-1 max-w-[60ch] text-small text-pretty text-fg-muted">
          {description}
        </p>
      ) : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:gap-6">
      <span className="w-20 shrink-0 text-meta text-fg-subtle">{label}</span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
