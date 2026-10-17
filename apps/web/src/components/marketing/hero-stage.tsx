"use client";

import { buttonVariants, cn, copyText } from "@shortn/ui";
import { ArrowRight, Check, Copy, Download, ExternalLink } from "lucide-react";
import {
  useCallback,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { QrMatrix, type QrModules } from "./qr-matrix";
import { useTurnstile } from "./turnstile";

export interface DemoLink {
  shortUrl: string;
  key: string;
  destination: string;
  qr: QrModules;
}

const errorCodes = [
  "invalid",
  "blocked",
  "rateLimited",
  "capReached",
  "challenge",
  "unavailable",
] as const;
type DemoError = (typeof errorCodes)[number];
const isDemoError = (value: unknown): value is DemoError =>
  errorCodes.some((code) => code === value);

export interface HeroLabels {
  primary: string;
  secondary: string;
  reassurance: string;
  example: string;
  destination: string;
  label: string;
  placeholder: string;
  submit: string;
  submitting: string;
  resultLabel: string;
  copy: string;
  copied: string;
  open: string;
  qrAlt: string;
  downloadQr: string;
  expiry: string;
  keep: string;
  another: string;
  report: string;
  errors: Record<DemoError, string>;
}

/**
 * The hero's mechanism (20 §2): paste a link, get a working short link and
 * its QR code in place of the example. Without the demo it is a plain CTA.
 */
export function HeroStage({
  intro,
  locale,
  demo,
  example,
  labels,
  registerHref,
  pricingHref,
}: {
  intro: ReactNode;
  locale: string;
  demo: { siteKey: string } | null;
  example: DemoLink;
  labels: HeroLabels;
  registerHref: string;
  pricingHref: string;
}) {
  const [result, setResult] = useState<DemoLink | null>(null);
  const [error, setError] = useState<DemoError | null>(null);
  const [pending, setPending] = useState(false);
  const [url, setUrl] = useState("");
  const widget = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const errorId = useId();
  const challengeFailed = useCallback(() => setError("challenge"), []);
  const turnstile = useTurnstile(
    widget,
    { siteKey: demo?.siteKey ?? null, action: "demo", locale },
    challengeFailed,
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const value = url.trim();
    if (!/^https?:\/\/\S+\.\S+/i.test(value)) {
      setError("invalid");
      input.current?.focus();
      return;
    }
    const token = turnstile.token();
    if (!token) {
      setError("challenge");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/${locale}/demo`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: value, token }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (response.ok && isDemoLink(body)) setResult(body);
      else
        setError(
          body && typeof body === "object" && "error" in body
            ? isDemoError(body.error)
              ? body.error
              : "unavailable"
            : "unavailable",
        );
    } catch {
      setError("unavailable");
    } finally {
      setPending(false);
      turnstile.reset();
    }
  }

  function again() {
    setResult(null);
    setUrl("");
    requestAnimationFrame(() => input.current?.focus());
  }

  const shown = result ?? example;

  return (
    <div className="grid gap-12 lg:grid-cols-12 lg:gap-10">
      <div className="flex flex-col lg:col-span-7">
        {intro}
        {demo ? (
          result ? (
            <div className="mt-9 flex max-w-[34rem] flex-col gap-4">
              <p className="text-body text-pretty text-fg-muted">
                {labels.expiry}
              </p>
              <div className="flex flex-wrap gap-2">
                <a
                  href={registerHref}
                  className={cn(
                    buttonVariants({ variant: "primary", size: "lg" }),
                    "h-11 px-5 text-emphasis",
                  )}
                >
                  {labels.keep}
                  <ArrowRight />
                </a>
                <button
                  type="button"
                  onClick={again}
                  className={cn(buttonVariants({ size: "lg" }), "h-11 px-4")}
                >
                  {labels.another}
                </button>
              </div>
            </div>
          ) : (
            <form
              onSubmit={submit}
              noValidate
              className="mt-9 flex max-w-[34rem] flex-col gap-3"
            >
              <label htmlFor={inputId} className="text-small font-medium">
                {labels.label}
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  ref={input}
                  id={inputId}
                  type="url"
                  inputMode="url"
                  autoComplete="url"
                  spellCheck={false}
                  required
                  value={url}
                  onChange={(event) => {
                    setUrl(event.target.value);
                    if (error === "invalid") setError(null);
                  }}
                  placeholder={labels.placeholder}
                  aria-invalid={error === "invalid" || undefined}
                  aria-describedby={error ? errorId : undefined}
                  className="h-12 w-full min-w-0 rounded-control sm:flex-1 border border-line-strong bg-field px-4 text-emphasis text-fg outline-none placeholder:text-fg-subtle focus-visible:border-signal focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-signal aria-invalid:border-danger"
                />
                <button
                  type="submit"
                  aria-disabled={pending}
                  className={cn(
                    buttonVariants({ variant: "primary", size: "lg" }),
                    "h-12 px-5 text-emphasis",
                  )}
                >
                  {pending ? labels.submitting : labels.submit}
                </button>
              </div>
              <div ref={widget} className="empty:hidden" />
              <p
                id={errorId}
                role="alert"
                className="text-body text-pretty text-danger"
              >
                {error ? labels.errors[error] : null}
              </p>
              <p className="text-small text-fg-muted">
                {labels.reassurance}{" "}
                <a
                  href={registerHref}
                  className="font-medium text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg"
                >
                  {labels.primary}
                </a>
              </p>
            </form>
          )
        ) : (
          <div className="mt-9 flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              <a
                href={registerHref}
                className={cn(
                  buttonVariants({ variant: "primary", size: "lg" }),
                  "h-12 px-5 text-emphasis",
                )}
              >
                {labels.primary}
                <ArrowRight />
              </a>
              <a
                href={pricingHref}
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "h-12 px-5 text-emphasis",
                )}
              >
                {labels.secondary}
              </a>
            </div>
            <p className="text-small text-fg-muted">{labels.reassurance}</p>
          </div>
        )}
      </div>
      <div className="lg:col-span-5 lg:pt-3">
        <LinkObject
          link={shown}
          live={Boolean(result)}
          labels={labels}
          reportHref={result ? `/${locale}/safety/${result.key}` : null}
        />
      </div>
    </div>
  );
}

function isDemoLink(value: unknown): value is DemoLink {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  const qr = record.qr as Record<string, unknown> | undefined;
  return (
    typeof record.shortUrl === "string" &&
    typeof record.key === "string" &&
    typeof record.destination === "string" &&
    typeof qr?.size === "number" &&
    typeof qr.bits === "string"
  );
}

function LinkObject({
  link,
  live,
  labels,
  reportHref,
}: {
  link: DemoLink;
  live: boolean;
  labels: HeroLabels;
  reportHref: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const display = link.shortUrl.replace(/^https?:\/\//, "");
  const host = display.slice(0, display.length - link.key.length);

  async function copy() {
    if (await copyText(link.shortUrl)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    }
  }

  function download() {
    const quiet = 2;
    const span = link.qr.size + quiet * 2;
    let path = "";
    for (let y = 0; y < link.qr.size; y++)
      for (let x = 0; x < link.qr.size; x++)
        if (link.qr.bits[y * link.qr.size + x] === "1")
          path += `M${x + quiet} ${y + quiet}h1v1h-1z`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${span} ${span}" width="1024" height="1024" shape-rendering="crispEdges"><rect width="${span}" height="${span}" fill="#fff"/><path d="${path}" fill="#0f172b"/></svg>`;
    const href = URL.createObjectURL(
      new Blob([svg], { type: "image/svg+xml" }),
    );
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `shortn-${link.key}.svg`;
    anchor.click();
    URL.revokeObjectURL(href);
  }

  return (
    <figure
      aria-live="polite"
      className="overflow-hidden rounded-overlay border border-line bg-field"
    >
      <figcaption className="flex h-10 items-center justify-between border-b border-line px-4 text-small text-fg-muted">
        <span>{live ? labels.resultLabel : labels.example}</span>
        {live ? <span className="size-2 rounded-full bg-success" /> : null}
      </figcaption>
      <div className="grid grid-cols-[1fr_auto] items-start gap-5 p-5 sm:p-6">
        <div className="flex min-w-0 flex-col gap-4">
          <p
            key={link.key}
            className="min-w-0 font-display text-subhead leading-tight font-bold tracking-[-0.02em] [overflow-wrap:anywhere]"
          >
            <span className="text-fg-muted">{host}</span>
            <span className={live ? "key-reveal" : undefined}>{link.key}</span>
          </p>
          <div className="min-w-0">
            <p className="text-meta text-fg-subtle">{labels.destination}</p>
            <p className="truncate font-mono text-small text-fg-muted">
              {link.destination}
            </p>
          </div>
        </div>
        <QrMatrix
          key={`qr-${link.key}`}
          modules={link.qr}
          label={labels.qrAlt.replace("{url}", display)}
          className={cn(
            "size-24 rounded-chip sm:size-28",
            live && "qr-resolve",
          )}
        />
      </div>
      {live ? (
        <div className="flex flex-wrap items-center gap-1 border-t border-line px-3 py-2">
          <button
            type="button"
            onClick={copy}
            className={buttonVariants({ variant: "ghost", size: "md" })}
          >
            {copied ? <Check /> : <Copy />}
            {copied ? labels.copied : labels.copy}
          </button>
          <>
            <a
              href={link.shortUrl}
              target="_blank"
              rel="noopener"
              className={buttonVariants({ variant: "ghost", size: "md" })}
            >
              <ExternalLink />
              {labels.open}
            </a>
            <button
              type="button"
              onClick={download}
              className={buttonVariants({ variant: "ghost", size: "md" })}
            >
              <Download />
              {labels.downloadQr}
            </button>
            {reportHref ? (
              <a
                href={reportHref}
                className="ml-auto px-2 text-small text-fg-muted underline-offset-4 hover:text-fg hover:underline"
              >
                {labels.report}
              </a>
            ) : null}
          </>
        </div>
      ) : null}
    </figure>
  );
}
