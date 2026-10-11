import { useCallback, useState } from "react";

/**
 * Tab state mirrored to `?tab=` so a tab can be shared or reloaded. The
 * first tab is the default and leaves the URL clean; other params stay.
 * Pass a module-level `tabs` array.
 */
export function useUrlTab<T extends string>(
  tabs: readonly [T, ...T[]],
  initial: T,
) {
  const [tab, setTab] = useState<T>(initial);
  const change = useCallback(
    (value: string) => {
      const next = tabs.find((candidate) => candidate === value);
      if (!next) return;
      setTab(next);
      const url = new URL(window.location.href);
      if (next === tabs[0]) url.searchParams.delete("tab");
      else url.searchParams.set("tab", next);
      window.history.replaceState(null, "", `${url.pathname}${url.search}`);
    },
    [tabs],
  );
  return [tab, change] as const;
}
