"use client";

import type { PlanId } from "@shortn/billing";
import type { QrView } from "@shortn/core";
import {
  Button,
  Checkbox,
  cn,
  Input,
  Label,
  ShortLink,
  Switch,
} from "@shortn/ui";
import { Check, Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { updateQrAction } from "@/server/actions/qr";
import { AuthField } from "../auth/auth-field";
import { ErrorText, settle, type ActionError } from "../editor/action-error";
import { ColorField } from "../editor/color-field";
import { ChoiceField, EditorSection } from "../editor/editor-section";
import { TagsField } from "../editor/tags-field";
import { GateNote, PlanGate } from "../plan-gate";
import { BreadcrumbTitle } from "../shell/breadcrumb-title";
import { PageHeader } from "../shell/page-header";
import {
  cornerStyles,
  designOf,
  type CornerStyle,
  dotStyles,
  draftOf,
  errorCapacity,
  errorLevels,
  qrUpdate,
  type QrDraft,
} from "./qr-draft";
import { QrDownloadMenu } from "./qr-download-menu";
import { useQrError, type QrField } from "./qr-errors";
import { QrImage } from "./qr-image";
import { stylingOptions } from "./qr-render";
import { scanIssues } from "./qr-scan-check";
import { QrScanReport } from "./qr-scan-report";
import { QrStyleSample } from "./qr-style-sample";

// Legacy's presets, plus the brand navy and plain black.
const presets = [
  "#0f172b",
  "#000000",
  "#de3121",
  "#ef8000",
  "#198639",
  "#229ce0",
  "#6b52d1",
] as const;

const httpUrl = /^https?:\/\/\S+$/i;

type Problem = { field: QrField; key: "urlRequired" | "logoUrl" | "color" };

function draftProblem(draft: QrDraft): Problem | null {
  if (!draft.url.trim()) return { field: "url", key: "urlRequired" };
  const logo = draft.logo.trim();
  if (logo && !httpUrl.test(logo)) return { field: "logo", key: "logoUrl" };
  const colors = [
    draft.foreground,
    draft.background,
    draft.cornerSquareColor ?? "#000",
    draft.cornerDotColor ?? "#000",
  ];
  if (colors.some((color) => !color.trim() || color.trim().length > 32))
    return { field: "form", key: "color" };
  return null;
}

export function QrEditor({
  workspace,
  qr: initialQr,
  tags,
  canEdit,
  logoGate,
}: {
  workspace: string;
  qr: QrView;
  tags: string[];
  canEdit: boolean;
  /** Plan that unlocks logos (qrLogo); null when included. */
  logoGate: PlanId | null;
}) {
  const t = useTranslations("qr");
  const toError = useQrError();
  const [qr, setQr] = useState(initialQr);
  const initial = useMemo(() => draftOf(qr), [qr]);
  const [draft, setDraft] = useState(initial);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<ActionError<QrField> | null>(null);
  const [logoFailed, setLogoFailed] = useState(false);
  const baseId = useId();
  const fieldIds: Record<QrField, string> = {
    url: `${baseId}-url`,
    logo: `${baseId}-logo`,
    form: `${baseId}-form`,
  };

  const update = useMemo(
    () => qrUpdate(qr, initial, draft),
    [qr, initial, draft],
  );
  const dirty = Object.keys(update).length > 0;
  const design = useMemo(() => designOf(qr.design, draft), [qr.design, draft]);
  const options = useMemo(
    () => stylingOptions(design, qr.shortUrl),
    [design, qr.shortUrl],
  );
  const issues = useMemo(
    () =>
      scanIssues({
        foreground: draft.foreground,
        background: draft.background,
        corners: [draft.cornerSquareColor, draft.cornerDotColor].flatMap(
          (color) => (color ? [color] : []),
        ),
        logo: draft.logo.trim() !== "",
        logoSize: draft.logoSize,
        errorLevel: draft.errorLevel,
        logoUnavailable: logoFailed,
      }),
    [draft, logoFailed],
  );

  const edit = (patch: Partial<QrDraft>) => {
    setSaved(false);
    setError(null);
    setDraft((current) => ({ ...current, ...patch }));
  };

  const fail = useCallback(
    (next: ActionError<QrField>) => {
      setError(next);
      if (next.field !== "form")
        window.requestAnimationFrame(() =>
          document.getElementById(`${baseId}-${next.field}`)?.focus(),
        );
    },
    [baseId],
  );

  const save = useCallback(async () => {
    if (!dirty || pending || !canEdit) return;
    const problem = draftProblem(draft);
    if (problem) {
      fail({ field: problem.field, message: t(`errors.${problem.key}`) });
      return;
    }
    setPending(true);
    setError(null);
    const result = await settle(updateQrAction(workspace, qr.id, update));
    setPending(false);
    if (!result.ok) {
      fail(toError(result));
      return;
    }
    setQr(result.data);
    setDraft(draftOf(result.data));
    setSaved(true);
  }, [
    dirty,
    pending,
    canEdit,
    draft,
    fail,
    t,
    workspace,
    qr.id,
    update,
    toError,
  ]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [save]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const onRendered = useCallback(
    (result: { logoFailed: boolean }) => setLogoFailed(result.logoFailed),
    [],
  );

  const domain = new URL(qr.shortUrl).host;
  const width = design.width ?? 300;
  const height = design.height ?? 300;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title={
          <BreadcrumbTitle
            trail={[
              { href: `/${workspace}/qr`, label: t("title") },
              { href: `/${workspace}/qr/${qr.id}`, label: qr.title || qr.key },
            ]}
          >
            {t("editor.title")}
          </BreadcrumbTitle>
        }
      >
        <div className="ml-auto flex items-center gap-2">
          <p
            role="status"
            className="flex items-center gap-1.5 text-small whitespace-nowrap text-fg-muted max-sm:sr-only"
          >
            {dirty ? (
              t("editor.unsaved")
            ) : saved ? (
              <>
                <Check aria-hidden className="size-4 text-success" />
                {t("editor.saved")}
              </>
            ) : null}
          </p>
          <QrDownloadMenu options={options} name={qr.publicId || qr.key} />
          {canEdit ? (
            <Button
              variant="primary"
              loading={pending}
              disabled={!dirty}
              shortcut={["mod", "s"]}
              onClick={() => void save()}
            >
              {t("editor.save")}
            </Button>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-small whitespace-nowrap text-fg-muted">
              <Lock aria-hidden className="size-3.5" />
              {t("viewOnly")}
            </span>
          )}
        </div>
      </PageHeader>

      {error?.field === "form" ? (
        <ErrorText
          id={fieldIds.form}
          error={error}
          className="shrink-0 border-b border-line px-gutter py-3"
        />
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(380px,42%)] lg:overflow-hidden">
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
          className="flex flex-col pb-10 lg:overflow-y-auto"
        >
          <fieldset disabled={!canEdit} className="contents">
            <legend className="sr-only">{t("editor.legend")}</legend>
            <ContentSection
              qr={qr}
              draft={draft}
              edit={edit}
              tags={tags}
              urlId={fieldIds.url}
              urlError={error?.field === "url" ? error.message : undefined}
            />
            <ColorsSection draft={draft} edit={edit} disabled={!canEdit} />
            <PatternSection draft={draft} edit={edit} disabled={!canEdit} />
            <EditorSection
              title={t("errorLevel.title")}
              description={t("errorLevel.description")}
            >
              <ChoiceField
                label={t("errorLevel.label")}
                options={errorLevels.map((level) => ({
                  value: level,
                  label: t("errorLevel.option", {
                    level,
                    share: Math.round(errorCapacity[level] * 100),
                  }),
                }))}
                value={draft.errorLevel}
                onValueChange={(errorLevel) => edit({ errorLevel })}
                disabled={!canEdit}
              />
            </EditorSection>
            <LogoSection
              draft={draft}
              edit={edit}
              gate={logoGate}
              canEdit={canEdit}
              urlId={fieldIds.logo}
              error={error?.field === "logo" ? error : null}
            />
          </fieldset>
        </form>

        <aside
          aria-label={t("preview.label")}
          className="border-line bg-bg-subtle max-lg:order-first max-lg:border-b lg:overflow-y-auto lg:border-l"
        >
          <div className="mx-auto flex max-w-110 flex-col items-center gap-6 px-gutter py-8">
            <figure className="flex w-full flex-col items-center gap-2">
              <QrImage
                options={options}
                size={width}
                alt={t("preview.alt", { link: `${domain}/${qr.key}` })}
                onRendered={onRendered}
                className="max-lg:max-w-60"
              />
              <figcaption className="font-mono text-meta text-fg-muted tabular-nums">
                {t("preview.size", { width, height })}
              </figcaption>
            </figure>
            <div className="flex w-full flex-col items-center gap-1">
              <ShortLink domain={domain} linkKey={qr.key} />
              <p className="max-w-full truncate text-meta text-fg-muted">
                {t("preview.opens", { url: qr.url })}
              </p>
            </div>
            <QrScanReport issues={issues} />
          </div>
        </aside>
      </div>
    </div>
  );
}

type Edit = (patch: Partial<QrDraft>) => void;

function ContentSection({
  qr,
  draft,
  edit,
  tags,
  urlId,
  urlError,
}: {
  qr: QrView;
  draft: QrDraft;
  edit: Edit;
  tags: string[];
  urlId: string;
  urlError: string | undefined;
}) {
  const t = useTranslations("qr.content");
  const id = useId();
  return (
    <EditorSection title={t("title")} description={t("description")}>
      <AuthField id={urlId} label={t("url")} error={urlError}>
        {(control) => (
          <Input
            {...control}
            type="url"
            inputMode="url"
            spellCheck={false}
            autoComplete="off"
            maxLength={2048}
            value={draft.url}
            onChange={(event) => edit({ url: event.target.value })}
          />
        )}
      </AuthField>
      {qr.attachedLinkKey ? (
        <div className="-mt-1 flex items-start gap-2.5">
          <Checkbox
            id={`${id}-apply`}
            checked={draft.applyToLink}
            onCheckedChange={(checked) =>
              edit({ applyToLink: checked === true })
            }
            className="mt-0.5"
          />
          <div className="flex min-w-0 flex-col gap-0.5">
            <Label htmlFor={`${id}-apply`} className="font-normal">
              {t.rich("applyToLink", {
                link: qr.attachedLinkKey,
                key: (chunks) => (
                  <span className="font-mono font-medium">{chunks}</span>
                ),
              })}
            </Label>
            <p className="text-meta text-fg-muted">{t("applyToLinkHint")}</p>
          </div>
        </div>
      ) : null}
      <AuthField id={`${id}-title`} label={t("titleLabel")}>
        {(control) => (
          <Input
            {...control}
            maxLength={200}
            value={draft.title}
            onChange={(event) => edit({ title: event.target.value })}
          />
        )}
      </AuthField>
      <AuthField id={`${id}-tags`} label={t("tags")}>
        {(control) => (
          <TagsField
            control={control}
            value={draft.tags}
            options={tags}
            onChange={(next) => edit({ tags: next })}
          />
        )}
      </AuthField>
    </EditorSection>
  );
}

function ColorsSection({
  draft,
  edit,
  disabled,
}: {
  draft: QrDraft;
  edit: Edit;
  disabled: boolean;
}) {
  const t = useTranslations("qr.colors");
  const id = useId();
  const presetsId = useId();
  const customCorners =
    draft.cornerSquareColor !== null || draft.cornerDotColor !== null;
  const cornerColor = draft.cornerSquareColor ?? draft.cornerDotColor ?? "";
  return (
    <EditorSection title={t("title")}>
      <div className="flex flex-col gap-1.5">
        <span id={presetsId} className="text-small font-medium">
          {t("presets")}
        </span>
        <div
          role="group"
          aria-labelledby={presetsId}
          className="flex flex-wrap gap-2"
        >
          {presets.map((color) => {
            const active =
              draft.foreground.toLowerCase() === color &&
              draft.background.toLowerCase() === "#ffffff";
            return (
              <button
                key={color}
                type="button"
                aria-pressed={active}
                aria-label={t("preset", { color })}
                disabled={disabled}
                onClick={() =>
                  edit({ foreground: color, background: "#ffffff" })
                }
                className={cn(
                  "grid size-7 cursor-pointer place-items-center rounded-full border border-line-strong",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal",
                  "aria-pressed:ring-2 aria-pressed:ring-signal aria-pressed:ring-offset-2 aria-pressed:ring-offset-bg",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                )}
                style={{ background: "#ffffff" }}
              >
                <span
                  aria-hidden
                  className="size-4 rounded-full"
                  style={{ background: color }}
                />
              </button>
            );
          })}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <AuthField id={`${id}-fg`} label={t("foreground")}>
          {(control) => (
            <ColorField
              control={control}
              value={draft.foreground}
              placeholder="#000000"
              pickerLabel={t("pickForeground")}
              disabled={disabled}
              onChange={(foreground) => edit({ foreground })}
            />
          )}
        </AuthField>
        <AuthField id={`${id}-bg`} label={t("background")}>
          {(control) => (
            <ColorField
              control={control}
              value={draft.background}
              placeholder="#ffffff"
              pickerLabel={t("pickBackground")}
              disabled={disabled}
              onChange={(background) => edit({ background })}
            />
          )}
        </AuthField>
      </div>
      <ChoiceField
        label={t("corners")}
        options={[
          { value: "code", label: t("cornersSame") },
          { value: "custom", label: t("cornersCustom") },
        ]}
        value={customCorners ? "custom" : "code"}
        onValueChange={(mode) =>
          mode === "code"
            ? edit({ cornerSquareColor: null, cornerDotColor: null })
            : edit({
                cornerSquareColor: draft.foreground,
                cornerDotColor: draft.foreground,
              })
        }
        disabled={disabled}
      />
      {customCorners ? (
        <AuthField id={`${id}-corner`} label={t("cornerColor")}>
          {(control) => (
            <ColorField
              control={control}
              value={cornerColor}
              placeholder={draft.foreground}
              pickerLabel={t("pickCorner")}
              disabled={disabled}
              onChange={(color) =>
                edit({ cornerSquareColor: color, cornerDotColor: color })
              }
              className="sm:max-w-[calc(50%-8px)]"
            />
          )}
        </AuthField>
      ) : null}
    </EditorSection>
  );
}

function PatternSection({
  draft,
  edit,
  disabled,
}: {
  draft: QrDraft;
  edit: Edit;
  disabled: boolean;
}) {
  const t = useTranslations("qr.pattern");
  const styleLabel = (style: CornerStyle) => t(`styles.${style}`);
  return (
    <EditorSection title={t("title")} description={t("description")}>
      <ChoiceField
        label={t("dots")}
        options={dotStyles.map((style) => ({
          value: style,
          label: styleLabel(style),
          visual: <QrStyleSample part="dots" style={style} />,
        }))}
        value={draft.dotStyle}
        onValueChange={(dotStyle) => edit({ dotStyle })}
        disabled={disabled}
      />
      <ChoiceField
        label={t("cornerSquares")}
        options={cornerStyles.map((style) => ({
          value: style,
          label: styleLabel(style),
          visual: <QrStyleSample part="cornerSquare" style={style} />,
        }))}
        value={draft.cornerSquareStyle ?? "square"}
        onValueChange={(cornerSquareStyle) => edit({ cornerSquareStyle })}
        disabled={disabled}
      />
      <ChoiceField
        label={t("cornerDots")}
        options={cornerStyles.map((style) => ({
          value: style,
          label: styleLabel(style),
          visual: <QrStyleSample part="cornerDot" style={style} />,
        }))}
        value={draft.cornerDotStyle ?? "square"}
        onValueChange={(cornerDotStyle) => edit({ cornerDotStyle })}
        disabled={disabled}
      />
    </EditorSection>
  );
}

function LogoSection({
  draft,
  edit,
  gate,
  canEdit,
  urlId,
  error,
}: {
  draft: QrDraft;
  edit: Edit;
  gate: PlanId | null;
  canEdit: boolean;
  urlId: string;
  error: ActionError<QrField> | null;
}) {
  const t = useTranslations("qr.logo");
  const id = useId();
  const hasLogo = draft.logo.trim() !== "";
  // A downgraded plan keeps the logo it has and may still remove it.
  const locked = gate !== null || !canEdit;
  let note: ReactNode = null;
  if (gate)
    note = hasLogo ? (
      <GateNote>{t("gatedExisting")}</GateNote>
    ) : (
      <PlanGate feature="qrLogo" plan={gate} />
    );
  return (
    <EditorSection title={t("title")} description={t("description")}>
      {note}
      <AuthField
        id={urlId}
        label={t("url")}
        hint={t("urlHint")}
        error={error?.message}
      >
        {(control) => (
          <div className="flex items-center gap-2">
            <Input
              {...control}
              type="url"
              inputMode="url"
              spellCheck={false}
              autoComplete="off"
              maxLength={2048}
              placeholder={t("urlPlaceholder")}
              value={draft.logo}
              disabled={locked}
              onChange={(event) => edit({ logo: event.target.value })}
              frameClassName="min-w-0 flex-1"
            />
            {hasLogo && canEdit ? (
              <Button variant="ghost" onClick={() => edit({ logo: "" })}>
                {t("remove")}
              </Button>
            ) : null}
          </div>
        )}
      </AuthField>
      {hasLogo ? (
        <>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between">
              <Label htmlFor={`${id}-size`}>{t("size")}</Label>
              <span className="font-mono text-small text-fg-muted tabular-nums">
                {Math.round(draft.logoSize * 100)}%
              </span>
            </div>
            <input
              id={`${id}-size`}
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={draft.logoSize}
              disabled={locked}
              aria-describedby={`${id}-size-hint`}
              onChange={(event) =>
                edit({ logoSize: Number(event.target.value) })
              }
              className="w-full cursor-pointer accent-signal disabled:cursor-not-allowed disabled:opacity-50"
            />
            <p id={`${id}-size-hint`} className="text-meta text-fg-muted">
              {t("sizeHint")}
            </p>
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor={`${id}-hide`} className="font-normal">
              {t("hideDots")}
            </Label>
            <Switch
              id={`${id}-hide`}
              checked={draft.hideDotsBehindLogo}
              disabled={locked}
              onCheckedChange={(checked) =>
                edit({ hideDotsBehindLogo: checked })
              }
            />
          </div>
        </>
      ) : null}
    </EditorSection>
  );
}
