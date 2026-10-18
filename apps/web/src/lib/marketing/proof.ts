// Largest-customer proof (21 §5); the customer is not named on the site. Recompute with the same definitions before
// each launch and update the figures and the date together.
export const proof = {
  measuredOn: "2026-10-17",
  scansSince: "2026-01-14",
  figures: {
    clicks: { value: 160000, plus: true },
    links: { value: 2600, plus: true },
    qrCodes: { value: 540, plus: false },
    scans: { value: 14000, plus: true },
  },
} as const;
