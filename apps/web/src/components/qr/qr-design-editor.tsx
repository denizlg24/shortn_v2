"use client";

import type { PlanId } from "@shortn/billing";
import type { QrDesign } from "@shortn/core";
import { cn, Input } from "@shortn/ui";
import { useTranslations } from "next-intl";
import { useCallback, useId, useMemo, useState, type ReactNode } from "react";
import { ColorField } from "../editor/color-field";
import { ChoiceField } from "../editor/option-group";
import { FormField } from "../page/form";
import { Section } from "../page/page";
import { ImageUpload, useUploadStatus } from "../page/image-upload";
import { GateNote, PlanGate } from "../plan-gate";
import {
  cornerStyles,
  designChanges,
  designOf,
  dotStyles,
  draftOf,
  draftProblem,
  errorCapacity,
  errorLevels,
  type CornerStyle,
  type QrDraft,
} from "./qr-draft";
import { QrImage } from "./qr-image";
import {
  gradientsIn,
  mergeDesign,
  printedOptions,
  printedSize,
} from "./qr-options";
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

export type QrEdit = (patch: Partial<QrDraft>) => void;

export interface QrDesignError {
  field: "logo" | "design";
  message: string;
}

/**
 * Editor state for one design. `whole` posts the full design (a new code);
 * otherwise only the changed option groups, which the server merges onto
 * what is stored. The preview draws that same merge, so it shows the code
 * the way it will print.
 */
export function useQrDesign({
  base,
  stored,
  data,
  whole,
}: {
  base: QrDesign;
  stored: Record<string, unknown>;
  data: string;
  whole: boolean;
}) {
  const initial = useMemo(() => draftOf(base), [base]);
  const [draft, setDraft] = useState(initial);
  const uploads = useUploadStatus();
  const [logoFailed, setLogoFailed] = useState(false);
  const edit = useCallback<QrEdit>(
    (patch) => setDraft((current) => ({ ...current, ...patch })),
    [],
  );
  const posted = useMemo(
    () => (whole ? designOf(base, draft) : designChanges(base, initial, draft)),
    [whole, base, initial, draft],
  );
  const options = useMemo(
    () => printedOptions(mergeDesign(stored, posted), data),
    [stored, posted, data],
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
  const onRendered = useCallback(
    (result: { logoFailed: boolean }) => setLogoFailed(result.logoFailed),
    [],
  );
  return {
    ...uploads,
    draft,
    edit,
    posted,
    dirty: whole || Object.keys(posted).length > 0,
    problem: draftProblem(draft),
    options,
    issues,
    onRendered,
    gradients: gradientsIn(stored).length > 0,
    size: printedSize(stored),
  };
}

export type QrDesignState = ReturnType<typeof useQrDesign>;

/** Form column and preview column; the preview stays in view on wide screens. */
export function QrSplit({
  children,
  preview,
}: {
  children: ReactNode;
  preview: ReactNode;
}) {
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(340px,40%)]">
      <div className="min-w-0 max-w-[640px]">{children}</div>
      <div className="max-lg:order-first">
        <div className="lg:sticky lg:top-17">{preview}</div>
      </div>
    </div>
  );
}

/** The code at the size it is drawn, its caption and the scan check. */
export function QrDesignPreview({
  state,
  alt,
  caption,
}: {
  state: QrDesignState;
  alt: string;
  caption?: ReactNode;
}) {
  const t = useTranslations("qr");
  const width = state.options.width ?? state.size.width;
  const height = state.options.height ?? state.size.height;
  return (
    <aside
      aria-label={t("preview.label")}
      className="flex flex-col items-center gap-6 border-y border-line bg-bg-subtle px-5 py-8 lg:border"
    >
      <figure className="flex w-full flex-col items-center gap-2">
        <QrImage
          options={state.options}
          size={width}
          alt={alt}
          onRendered={state.onRendered}
        />
        <figcaption className="font-mono text-meta text-fg-muted tabular-nums">
          {t("preview.size", { width, height })}
        </figcaption>
      </figure>
      {state.problem === "caption" ? (
        <p role="alert" className="text-center text-small text-danger">
          {t("errors.caption")}
        </p>
      ) : (
        <>
          {caption}
          <QrScanReport issues={state.issues} />
        </>
      )}
    </aside>
  );
}

/** Colours, pattern, error correction and logo, each its own section. */
export function QrDesignSections({
  state,
  logoGate,
  error,
}: {
  state: QrDesignState;
  /** Plan that unlocks logos (qrLogo); null when included. */
  logoGate: PlanId | null;
  /** A server or pre-submit error, on the section it concerns. */
  error: QrDesignError | null;
}) {
  const t = useTranslations("qr");
  const { draft, edit } = state;
  return (
    <>
      <TreatmentSection
        draft={draft}
        edit={edit}
        error={state.problem === "caption" ? error?.message : undefined}
      />
      <ColorsSection
        draft={draft}
        edit={edit}
        gradients={state.gradients}
        error={
          error?.field === "design" && state.problem !== "caption"
            ? error.message
            : undefined
        }
      />
      <PatternSection draft={draft} edit={edit} />
      <Section
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
        />
      </Section>
      <LogoSection
        onBusyChange={state.onBusyChange}
        draft={draft}
        edit={edit}
        gate={logoGate}
        error={error?.field === "logo" ? error.message : undefined}
      />
    </>
  );
}

function TreatmentSection({
  draft,
  edit,
  error,
}: {
  draft: QrDraft;
  edit: QrEdit;
  error: string | undefined;
}) {
  const t = useTranslations("qr.treatment");
  const id = useId();
  return (
    <Section title={t("title")} description={t("description")}>
      <div className="flex flex-col gap-5">
        <ChoiceField
          label={t("shape")}
          value={draft.shape}
          onValueChange={(shape) => edit({ shape })}
          options={(["square", "circle"] as const).map((value) => ({
            value,
            label: t(`shapes.${value}`),
          }))}
        />
        <ChoiceField
          label={t("frame")}
          value={draft.frame}
          onValueChange={(frame) => edit({ frame })}
          options={(["none", "outline", "solid"] as const).map((value) => ({
            value,
            label: t(`frames.${value}`),
          }))}
        />
        <FormField
          id={id}
          label={t("caption")}
          hint={t("captionHint")}
          error={error}
        >
          <Input
            id={id}
            name="qr-caption"
            value={draft.caption}
            maxLength={64}
            onChange={(event) => edit({ caption: event.target.value })}
            aria-invalid={Boolean(error) || undefined}
          />
        </FormField>
      </div>
    </Section>
  );
}

function ColorsSection({
  draft,
  edit,
  gradients,
  error,
}: {
  draft: QrDraft;
  edit: QrEdit;
  gradients: boolean;
  error: string | undefined;
}) {
  const t = useTranslations("qr.colors");
  const id = useId();
  const customCorners =
    draft.cornerSquareColor !== null || draft.cornerDotColor !== null;
  const cornerColor = draft.cornerSquareColor ?? draft.cornerDotColor ?? "";
  return (
    <Section title={t("title")}>
      <div className="flex flex-col gap-5">
        {gradients ? <GateNote>{t("gradients")}</GateNote> : null}
        <div className="flex flex-col gap-1.5">
          <span id={`${id}-presets`} className="text-small font-medium">
            {t("presets")}
          </span>
          <div
            role="group"
            aria-labelledby={`${id}-presets`}
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
                  onClick={() =>
                    edit({ foreground: color, background: "#ffffff" })
                  }
                  className={cn(
                    "grid size-7 cursor-pointer place-items-center rounded-full border border-line-strong bg-white",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal",
                    "aria-pressed:ring-2 aria-pressed:ring-signal aria-pressed:ring-offset-2 aria-pressed:ring-offset-bg",
                  )}
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
          <FormField id={`${id}-fg`} label={t("foreground")}>
            <ColorField
              id={`${id}-fg`}
              value={draft.foreground}
              placeholder="#000000"
              pickerLabel={t("pickForeground")}
              invalid={Boolean(error) && !draft.foreground.trim()}
              onChange={(foreground) => edit({ foreground })}
            />
          </FormField>
          <FormField id={`${id}-bg`} label={t("background")}>
            <ColorField
              id={`${id}-bg`}
              value={draft.background}
              placeholder="#ffffff"
              pickerLabel={t("pickBackground")}
              invalid={Boolean(error) && !draft.background.trim()}
              onChange={(background) => edit({ background })}
            />
          </FormField>
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
        />
        {customCorners ? (
          <FormField id={`${id}-corner`} label={t("cornerColor")}>
            <ColorField
              id={`${id}-corner`}
              value={cornerColor}
              placeholder={draft.foreground}
              pickerLabel={t("pickCorner")}
              onChange={(color) =>
                edit({ cornerSquareColor: color, cornerDotColor: color })
              }
              className="sm:max-w-[calc(50%-8px)]"
            />
          </FormField>
        ) : null}
        {error ? (
          <p role="alert" className="text-small text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </Section>
  );
}

function PatternSection({ draft, edit }: { draft: QrDraft; edit: QrEdit }) {
  const t = useTranslations("qr.pattern");
  const styleLabel = (style: CornerStyle) => t(`styles.${style}`);
  return (
    <Section title={t("title")} description={t("description")}>
      <div className="flex flex-col gap-5">
        <ChoiceField
          label={t("dots")}
          options={dotStyles.map((style) => ({
            value: style,
            label: styleLabel(style),
            visual: <QrStyleSample part="dots" style={style} />,
          }))}
          value={draft.dotStyle}
          onValueChange={(dotStyle) => edit({ dotStyle })}
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
        />
      </div>
    </Section>
  );
}

function LogoSection({
  draft,
  edit,
  gate,
  error,
  onBusyChange,
}: {
  onBusyChange: (busy: boolean) => void;
  draft: QrDraft;
  edit: QrEdit;
  gate: PlanId | null;
  error: string | undefined;
}) {
  const t = useTranslations("qr.logo");
  const id = useId();
  const hasLogo = draft.logo.trim() !== "";
  // A downgraded plan keeps the logo it has and may still remove it.
  const locked = gate !== null;
  return (
    <Section title={t("title")} description={t("description")}>
      <div className="flex flex-col gap-5">
        {gate ? (
          hasLogo ? (
            <GateNote>{t("gatedExisting")}</GateNote>
          ) : (
            <PlanGate feature="qrLogo" plan={gate} />
          )
        ) : null}
        <FormField
          id={`${id}-logo`}
          label={t("url")}
          hint={t("urlHint")}
          error={error}
        >
          <ImageUpload
            id={`${id}-logo`}
            label={t("url")}
            value={draft.logo}
            onChange={(logo) => edit({ logo })}
            purpose="qr-logo"
            disabled={locked}
            onBusyChange={onBusyChange}
          />
        </FormField>
        {hasLogo ? (
          <>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between">
                <label
                  htmlFor={`${id}-size`}
                  className="text-small font-medium"
                >
                  {t("size")}
                </label>
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
              <p id={`${id}-size-hint`} className="text-small text-fg-muted">
                {t("sizeHint")}
              </p>
            </div>
            <label className="flex items-center gap-2 text-small">
              <input
                type="checkbox"
                checked={draft.hideDotsBehindLogo}
                disabled={locked}
                onChange={(event) =>
                  edit({ hideDotsBehindLogo: event.target.checked })
                }
                className="size-4 accent-[var(--color-signal)]"
              />
              {t("hideDots")}
            </label>
          </>
        ) : null}
      </div>
    </Section>
  );
}
