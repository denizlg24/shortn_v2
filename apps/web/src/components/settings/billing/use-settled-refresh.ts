import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

// The subscription mirror follows Polar's webhook a few seconds after a
// change, so the page re-reads it twice instead of asking the user to reload.
const delays = [3_000, 9_000];

export function useSettledRefresh() {
  const router = useRouter();
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clear = useCallback(() => {
    for (const timer of timers.current) clearTimeout(timer);
    timers.current = [];
  }, []);

  useEffect(() => clear, [clear]);

  return useCallback(() => {
    clear();
    router.refresh();
    timers.current = delays.map((delay) =>
      setTimeout(() => router.refresh(), delay),
    );
  }, [clear, router]);
}
