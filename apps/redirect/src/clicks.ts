import { clickMessageSchema, encodeClickMessage } from "@shortn/core";
import type { ClickMessage } from "@shortn/core";
import { keys } from "@shortn/redis";
import { appendFile, rename, unlink } from "node:fs/promises";
import { metrics } from "./metrics";

export interface StreamWriter {
  xadd(key: string, id: string, ...fields: string[]): Promise<string | null>;
}

export type Enqueue = (message: ClickMessage) => void;

// XADD never trims (04 §Trimming). When Redis is unreachable, events go to a
// local append-only spool and are replayed once it answers again. The spool
// lives in the container filesystem, so it only survives process restarts.
export function createClickQueue(
  stream: StreamWriter,
  spoolPath: string,
  log: (message: string) => void = console.error,
) {
  let spooled: ClickMessage[] = [];
  let draining: Promise<void> | undefined;
  metrics.gauge("click_spool_size", () => spooled.length);

  const write = async (message: ClickMessage) => {
    await stream.xadd(keys.clicksStream, "*", ...encodeClickMessage(message));
  };

  const spool = async (message: ClickMessage) => {
    spooled.push(message);
    metrics.inc("click_spooled_total");
    try {
      await appendFile(spoolPath, `${JSON.stringify(message)}\n`);
    } catch (error) {
      log(`click spool write failed: ${String(error)}`);
    }
  };

  const persist = async () => {
    if (!spooled.length) {
      await unlink(spoolPath).catch(() => undefined);
      return;
    }
    const temporary = `${spoolPath}.tmp`;
    await Bun.write(
      temporary,
      spooled.map((message) => JSON.stringify(message)).join("\n") + "\n",
    );
    await rename(temporary, spoolPath);
  };

  const drain = () => {
    draining ??= (async () => {
      try {
        while (spooled.length) {
          const next = spooled[0];
          if (!next) break;
          await write(next);
          spooled.shift();
          metrics.inc("click_replayed_total");
        }
      } catch {
        /* Redis is still unreachable; the next drain retries. */
      } finally {
        await persist().catch((error: unknown) =>
          log(`click spool persist failed: ${String(error)}`),
        );
        draining = undefined;
      }
    })();
    return draining;
  };

  const enqueue: Enqueue = (message) => {
    metrics.inc("click_enqueued_total");
    if (spooled.length) {
      void spool(message);
      return;
    }
    write(message).catch(() => spool(message));
  };

  return {
    enqueue,
    drain,
    get spooled() {
      return spooled.length;
    },
    async load() {
      const file = Bun.file(spoolPath);
      if (!(await file.exists())) return;
      spooled = (await file.text())
        .split("\n")
        .filter(Boolean)
        .flatMap((line) => {
          try {
            const parsed = clickMessageSchema.safeParse(JSON.parse(line));
            return parsed.success ? [parsed.data] : [];
          } catch {
            return [];
          }
        });
    },
  };
}
