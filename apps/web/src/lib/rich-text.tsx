import type { ReactNode } from "react";

// Tag renderer for `t.rich` messages. Kept out of client modules so server
// components can call it too.
export const strong = (chunks: ReactNode) => (
  <strong className="font-medium text-fg">{chunks}</strong>
);
