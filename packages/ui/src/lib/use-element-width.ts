import { useLayoutEffect, useState, type RefObject } from "react";

export function useElementWidth(
  ref: RefObject<HTMLElement | null>,
  initial = 1200,
): number {
  const [width, setWidth] = useState(initial);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    setWidth(element.clientWidth);
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}
