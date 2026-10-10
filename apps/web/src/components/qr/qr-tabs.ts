// Plain constants, so server pages can read them (exports of a client
// module reach the server only as references).
export const qrViews = ["grid", "list"] as const;
export type QrViewMode = (typeof qrViews)[number];
