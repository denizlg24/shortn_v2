"use client";

import { useEffect, useRef, type RefObject } from "react";

type TurnstileApi = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  getResponse: (id: string) => string | undefined;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const source =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function load(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  return new Promise((resolve, reject) => {
    let script = document.querySelector<HTMLScriptElement>(
      `script[src="${source}"]`,
    );
    if (!script) {
      script = document.createElement("script");
      script.src = source;
      script.async = true;
      document.head.append(script);
    }
    script.addEventListener("load", () =>
      window.turnstile ? resolve(window.turnstile) : reject(new Error()),
    );
    script.addEventListener("error", () => reject(new Error()));
  });
}

export interface TurnstileHandle {
  /** Resolves once Cloudflare has issued a token, or undefined after 8 s. */
  token: () => Promise<string | undefined>;
  reset: () => void;
}

/**
 * Cloudflare Turnstile, shown only when Cloudflare needs an interaction.
 * Pass a null site key until the visitor engages with the form, so the
 * script never loads for visitors who only read the page.
 */
export function useTurnstile(
  element: RefObject<HTMLElement | null>,
  options: { siteKey: string | null; action: string; locale: string },
  onError: () => void,
): TurnstileHandle {
  const widget = useRef<string | null>(null);
  const { siteKey, action, locale } = options;
  useEffect(() => {
    const target = element.current;
    if (!siteKey || !target) return;
    let cancelled = false;
    load()
      .then((api) => {
        if (cancelled) return;
        widget.current = api.render(target, {
          sitekey: siteKey,
          appearance: "interaction-only",
          action,
          language: locale,
          "refresh-expired": "auto",
        });
      })
      .catch(onError);
    return () => {
      cancelled = true;
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = null;
    };
  }, [element, siteKey, action, locale, onError]);
  return {
    token: async () => {
      for (let waited = 0; waited <= 8000; waited += 250) {
        const value = widget.current
          ? window.turnstile?.getResponse(widget.current)
          : undefined;
        if (value) return value;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      return undefined;
    },
    reset: () => {
      if (widget.current) window.turnstile?.reset(widget.current);
    },
  };
}
