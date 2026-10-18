import { randomUUID } from "node:crypto";

/** Persist with the destination mutation; Redis is a disposable execution index. */
export const requestSafetyScan = (now = new Date()) => ({
  generation: randomUUID(),
  dueAt: now,
  attempts: 0,
});
export interface SafetyScanLease {
  generation: string;
  token: string;
}
