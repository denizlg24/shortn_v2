"use client";

import "driver.js/dist/driver.css";
import "./tour.css";
import type { PlanId } from "@shortn/billing/catalog";
import {
  driver,
  type Driver,
  type DriveStep,
  type PopoverDOM,
} from "driver.js";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { browserStore } from "@/lib/browser-store";
import { stepAccess, stepBadge, type StepBadge } from "@/lib/tour/access";
import {
  progressOnLoad,
  readProgress,
  writeProgress,
  type TourProgress,
} from "@/lib/tour/progress";
import {
  docsHref,
  stepHref,
  tourSteps,
  type TourEntity,
  type TourTargets,
} from "@/lib/tour/steps";
import { tourDataAction } from "@/server/actions/tour";
import { billingHref } from "../plan-gate";
import { useShell } from "../shell/shell-context";
import {
  arrowUpRightIcon,
  element,
  escapeHtml,
  lockIcon,
  strokeIcon,
  waitForAnchor,
  waitUntil,
} from "./tour-dom";

interface TourValue {
  progress: TourProgress;
  total: number;
  /** Starts at the first step, or at `step` to resume. */
  start: (step?: number) => void;
}

const TourContext = createContext<TourValue | null>(null);

export function useTour(): TourValue {
  const value = useContext(TourContext);
  if (!value) throw new Error("useTour must be used inside <TourProvider>");
  return value;
}

const total = tourSteps.length;
const noTargets: TourTargets = { link: null, qr: null, bio: null };
const routeTimeout = 10_000;
const anchorTimeout = 4_000;
const focusReclaimWindow = 500;

/** What the popover needs to know about the step on screen. */
interface Shown {
  index: number;
  found: boolean;
  missingEntity: TourEntity | null;
  badge: StepBadge | null;
}

/**
 * This tab's progress: loaded from storage once, then kept in memory so the
 * tour still knows its step when storage is unavailable. Other tabs' progress
 * is picked up on their next load, not live.
 */
const progressStore = (() => {
  const listeners = new Set<() => void>();
  const idle: TourProgress = { status: "idle" };
  let current: TourProgress | null = null;
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    snapshot: () =>
      (current ??= progressOnLoad(readProgress(browserStore, total))),
    serverSnapshot: () => idle,
    save(next: TourProgress) {
      current = next;
      writeProgress(browserStore, next);
      for (const listener of listeners) listener();
    },
  };
})();

const samePath = (href: string) =>
  decodeURIComponent(window.location.pathname) === decodeURIComponent(href);

const reducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function TourProvider({ children }: { children: ReactNode }) {
  const t = useTranslations("tour");
  const tGate = useTranslations("gate");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { workspace } = useShell();
  const progress = useSyncExternalStore(
    progressStore.subscribe,
    progressStore.snapshot,
    progressStore.serverSnapshot,
  );

  const driverRef = useRef<Driver | null>(null);
  const runRef = useRef<AbortController | null>(null);
  const shownRef = useRef<Shown | null>(null);
  const expectedPathRef = useRef<string | null>(null);
  const navigatingRef = useRef(false);
  const redirectedRef = useRef(new Set<string>());
  const dataRef = useRef<{
    targets: TourTargets;
    domainAllowance: number | null;
  }>({ targets: noTargets, domainAllowance: null });

  const teardown = useCallback(() => {
    runRef.current?.abort();
    runRef.current = null;
    navigatingRef.current = false;
    shownRef.current = null;
    expectedPathRef.current = null;
    driverRef.current?.destroy();
  }, []);

  const pause = useCallback(
    (step: number) => {
      teardown();
      progressStore.save({ status: "paused", step });
    },
    [teardown],
  );

  const finish = useCallback(() => {
    teardown();
    progressStore.save({ status: "done" });
  }, [teardown]);

  const planName = useCallback(
    (plan: PlanId) => tGate(`plans.${plan}`),
    [tGate],
  );

  const badgeText = useCallback(
    (badge: StepBadge) => {
      switch (badge.kind) {
        case "plan":
          return planName(badge.plan);
        case "planAddon":
          return t("badges.planAddon", { plan: planName(badge.plan) });
        case "addon":
          return t("badges.addon");
      }
    },
    [planName, t],
  );

  const lockedText = useCallback(
    (badge: StepBadge) =>
      badge.kind === "addon"
        ? t("locked.addon")
        : t(`locked.${badge.kind}`, {
            current: planName(workspace.plan),
            plan: planName(badge.plan),
          }),
    [planName, t, workspace.plan],
  );

  // Fills the popover with text nodes only: driver.js writes its title and
  // description through innerHTML.
  const decorate = useCallback(
    (popover: PopoverDOM, shown: Shown) => {
      const step = tourSteps[shown.index];
      if (!step) return;
      const { badge } = shown;
      popover.wrapper.setAttribute("aria-modal", "true");
      popover.wrapper.setAttribute("aria-roledescription", t("label"));

      popover.title.replaceChildren(
        element("span", "shortn-tour-title-text", t(`steps.${step.id}.title`)),
      );
      if (badge)
        popover.title.append(
          element("span", "shortn-tour-badge", badgeText(badge)),
        );

      const body: HTMLElement[] = [
        element("p", "shortn-tour-body", t(`steps.${step.id}.body`)),
      ];
      if (!shown.found)
        body.push(
          element(
            "p",
            "shortn-tour-note",
            t(
              shown.missingEntity
                ? `fallback.${shown.missingEntity}`
                : "fallback.hidden",
            ),
          ),
        );
      if (badge) {
        const gate = element("p", "shortn-tour-gate");
        gate.append(strokeIcon(lockIcon, "shortn-tour-icon"));
        const text = element("span", "", lockedText(badge));
        if (badge.kind !== "addon") {
          const href = billingHref(workspace.slug);
          const upgrade = element("a", "shortn-tour-link", t("upgrade"));
          upgrade.href = href;
          upgrade.addEventListener("click", (event) => {
            event.preventDefault();
            pause(shown.index);
            router.push(href);
          });
          text.append(" ", upgrade);
        }
        gate.append(text);
        body.push(gate);
      }
      if ("docs" in step) {
        const docs = element("a", "shortn-tour-docs", t("learnMore"));
        docs.href = docsHref(step.docs, locale);
        docs.target = "_blank";
        docs.rel = "noopener";
        docs.append(
          strokeIcon(arrowUpRightIcon, "shortn-tour-icon"),
          element("span", "sr-only", t("newTab")),
        );
        body.push(docs);
      }
      popover.description.replaceChildren(...body);
      popover.description.style.display = "block";

      popover.progress.textContent = t("progress", {
        current: shown.index + 1,
        total,
      });
      popover.closeButton.textContent = t("skip");
      popover.footerButtons.prepend(popover.closeButton);
      // driver.js focuses the first control; Next is the one people want.
      const focusNext = () => {
        if (popover.nextButton.isConnected) popover.nextButton.focus();
      };
      requestAnimationFrame(focusNext);
      // The menu, drawer or dialog that started the tour hands focus back to
      // its trigger as it closes, which can land after the popover opens.
      const reclaim = (event: FocusEvent) => {
        if (
          event.target instanceof Node &&
          !popover.wrapper.contains(event.target)
        )
          focusNext();
      };
      document.addEventListener("focusin", reclaim);
      setTimeout(
        () => document.removeEventListener("focusin", reclaim),
        focusReclaimWindow,
      );
    },
    [badgeText, locale, lockedText, pause, router, t, workspace.slug],
  );

  const show = useCallback(
    async (index: number) => {
      const step = tourSteps[index];
      if (!step) return;
      runRef.current?.abort();
      const run = new AbortController();
      runRef.current = run;
      progressStore.save({ status: "active", step: index });

      const target = stepHref(step, workspace.slug, dataRef.current.targets);
      navigatingRef.current = true;
      let landed = true;
      if (target && !samePath(target.href)) {
        if (redirectedRef.current.has(target.href)) landed = false;
        else {
          const from = window.location.pathname;
          driverRef.current?.destroy();
          router.push(target.href);
          // A page the member's role can't open redirects elsewhere.
          await waitUntil(
            () => samePath(target.href) || window.location.pathname !== from,
            routeTimeout,
            run.signal,
          );
          landed = samePath(target.href);
          if (!landed && window.location.pathname !== from)
            redirectedRef.current.add(target.href);
        }
      }
      const found =
        "anchor" in step && landed
          ? await waitForAnchor(step.anchor, anchorTimeout, run.signal)
          : null;
      if (run.signal.aborted) return;
      navigatingRef.current = false;
      expectedPathRef.current = window.location.pathname;

      const shown: Shown = {
        index,
        found: found !== null || !("anchor" in step),
        missingEntity: target?.missingEntity ?? null,
        badge: stepBadge(
          stepAccess("requirement" in step ? step.requirement : undefined, {
            plan: workspace.plan,
            domainAllowance: dataRef.current.domainAllowance,
          }),
        ),
      };
      shownRef.current = shown;

      const current: DriveStep = {
        ...(found ? { element: found } : {}),
        popover: {
          title: escapeHtml(t(`steps.${step.id}.title`)),
          description: " ",
          showButtons:
            index === 0 ? ["next", "close"] : ["next", "previous", "close"],
          onPopoverRender: (popover) => decorate(popover, shown),
        },
      };
      const placeholder: DriveStep = { popover: { title: " " } };
      const drv = driverRef.current;
      if (!drv) return;
      drv.destroy();
      drv.setConfig({
        ...drv.getConfig(),
        smoothScroll: !reducedMotion(),
        steps: tourSteps.map((_, at) => (at === index ? current : placeholder)),
      });
      drv.drive(index);
    },
    [decorate, router, t, workspace.plan, workspace.slug],
  );

  const showRef = useRef(show);
  const finishRef = useRef(finish);
  const pauseRef = useRef(pause);
  useEffect(() => {
    showRef.current = show;
    finishRef.current = finish;
    pauseRef.current = pause;
  }, [show, finish, pause]);

  useEffect(() => {
    const drv = driver({
      animate: false,
      allowClose: true,
      overlayClickBehavior: "none",
      overlayColor: "var(--tour-overlay)",
      overlayOpacity: 1,
      stagePadding: 6,
      stageRadius: 8,
      popoverOffset: 12,
      popoverClass: "shortn-tour",
      disableActiveInteraction: true,
      showProgress: true,
      nextBtnText: escapeHtml(t("next")),
      prevBtnText: escapeHtml(t("back")),
      doneBtnText: escapeHtml(t("done")),
      closeBtnLabel: t("skip"),
      onNextClick: () => {
        const shown = shownRef.current;
        if (!shown) return;
        if (shown.index >= total - 1) finishRef.current();
        else void showRef.current(shown.index + 1);
      },
      onPrevClick: () => {
        const shown = shownRef.current;
        if (shown && shown.index > 0) void showRef.current(shown.index - 1);
      },
      // Escape and Skip both land here; the tour pauses where it was.
      onDestroyStarted: () => {
        const shown = shownRef.current;
        if (shown) pauseRef.current(shown.index);
        else drv.destroy();
      },
    });
    driverRef.current = drv;
    // The dashboard scrolls inside <main>, which driver.js doesn't watch.
    const refresh = () => {
      if (drv.isActive()) drv.refresh();
    };
    document.addEventListener("scroll", refresh, {
      capture: true,
      passive: true,
    });
    return () => {
      document.removeEventListener("scroll", refresh, { capture: true });
      runRef.current?.abort();
      drv.destroy();
      driverRef.current = null;
    };
  }, [t]);

  // Leaving the tour's page another way (back button, a link) pauses it.
  useEffect(() => {
    const expected = expectedPathRef.current;
    const shown = shownRef.current;
    if (!expected || !shown || navigatingRef.current) return;
    if (decodeURIComponent(pathname) !== decodeURIComponent(expected))
      pauseRef.current(shown.index);
  }, [pathname]);

  const start = useCallback(
    (step = 0) => {
      void (async () => {
        redirectedRef.current.clear();
        try {
          const data = await tourDataAction(workspace.slug);
          dataRef.current = data;
        } catch {
          dataRef.current = { targets: noTargets, domainAllowance: null };
        }
        await showRef.current(Math.min(Math.max(step, 0), total - 1));
      })();
    },
    [workspace.slug],
  );

  const value = useMemo<TourValue>(
    () => ({ progress, total, start }),
    [progress, start],
  );

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}
