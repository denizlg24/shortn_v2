"use client";

import { buttonVariants, cn } from "@shortn/ui";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";

export interface SafetyContinueLabels {
  /** Countdown labels keyed by seconds left (3, 2, 1). */
  wait: Record<number, string>;
  continue: string;
  /** Countdown done, token still on its way. */
  preparing: string;
  ready: string;
  failed: string;
  retry: string;
}

const countdownSeconds = 3;

const tokenOf = (body: unknown) =>
  typeof body === "object" &&
  body !== null &&
  "token" in body &&
  typeof body.token === "string"
    ? body.token
    : null;

/**
 * The confirmation token is fetched only after the page runs, like legacy,
 * so crawlers that don't execute JavaScript can't skip the interstitial.
 */
export function SafetyContinue({
  tokenUrl,
  target,
  labels,
}: {
  tokenUrl: string;
  /** Relative short-link path, so it stays on whichever host serves the page. */
  target: string;
  labels: SafetyContinueLabels;
}) {
  const [remaining, setRemaining] = useState(countdownSeconds);
  const [token, setToken] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const timer = setInterval(
      () => setRemaining((seconds) => Math.max(0, seconds - 1)),
      1000,
    );
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch(tokenUrl, { cache: "no-store", signal: controller.signal })
      .then((response) =>
        response.ok ? response.json() : Promise.reject(response.status),
      )
      .then((body: unknown) => {
        const value = tokenOf(body);
        if (value) setToken(value);
        else setFailed(true);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [tokenUrl, attempt]);

  const ready = remaining === 0 && token !== null;
  const primary = cn(
    buttonVariants({ variant: "primary", size: "lg" }),
    "w-full",
  );

  if (failed)
    return (
      <div role="alert" className="flex flex-col gap-3">
        <p className="text-small text-danger">{labels.failed}</p>
        <button
          type="button"
          className={cn(buttonVariants({ size: "lg" }), "w-full")}
          onClick={() => {
            setFailed(false);
            setAttempt((value) => value + 1);
          }}
        >
          {labels.retry}
        </button>
      </div>
    );

  return (
    <>
      {ready ? (
        <a
          href={`${target}?token=${encodeURIComponent(token)}`}
          className={primary}
        >
          {labels.continue}
          <ArrowRight aria-hidden />
        </a>
      ) : (
        <button type="button" disabled className={primary}>
          <span className="tabular-nums">
            {remaining > 0
              ? (labels.wait[remaining] ?? labels.preparing)
              : labels.preparing}
          </span>
        </button>
      )}
      <p aria-live="polite" className="sr-only">
        {ready ? labels.ready : ""}
      </p>
    </>
  );
}
