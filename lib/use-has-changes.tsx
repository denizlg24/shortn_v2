import { useState, useEffect, useMemo } from "react";
import { deepEqual } from "./utils";

export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

// ---- Main Hook ----
export function useHasObjectChanges<T>(current: T, initial: T, delay = 300) {
  const debounced = useDebounce(current, delay);

  const hasChanges = useMemo(() => {
    return !deepEqual(debounced, initial);
  }, [debounced, initial]);

  return hasChanges;
}
