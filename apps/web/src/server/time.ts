import "server-only";

// Request-time windows for server pages (kept out of render bodies).
export const daysAgo = (days: number) =>
  new Date(Date.now() - days * 86_400_000);

export const lastDays = (days: number) => ({
  from: daysAgo(days),
  to: new Date(),
});

/** The request's "now", for relative dates in server pages. */
export const requestTime = () => new Date();
