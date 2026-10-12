# apps/worker/src/ingest.ts

- StreamEntry · type · L14-L14 — type StreamEntry = [id: string, fields: string[]];
- StreamClient · type · L16-L19 — type StreamClient = Pick< Redis, "xgroup" | "xreadgroup" | "xautoclaim" | "xack" | "hincrby" | "expire" >;
- LinkDoc · interface · L21-L26 — interface LinkDoc
- QrDoc · interface · L27-L31 — interface QrDoc
- Decoded · interface · L33-L36 — interface Decoded
- isoDay · function · L38-L38 — isoDay = (ts: number)
- ensureGroup · function · L40-L52 — async function ensureGroup(stream: StreamClient)
- writeBatch · function · L57-L244 — async function writeBatch( db: Db, decoded: Decoded[], options: { redelivered: boolean; ipSecret: string }, )
- decodeEntries · function · L246-L257 — function decodeEntries(entries: StreamEntry[])
- createIngest · function · L259-L386 — function createIngest(options: { stream: StreamClient; db: Db; ipSecret: string; consumer: string; batchSize?: number; blockMs?: number; log?: (message: string, error?: unknown) => void; })
- handle · function · L275-L306 — handle = async (entries: StreamEntry[], redelivered: boolean)
- read · function · L308-L334 — read = async (id: string): Promise<StreamEntry[]>
- claimStale · function · L336-L348 — claimStale = async ()
- lastLoopAt · method · L352-L354 — get lastLoopAt()
- run · method · L355-L380 — async run()
- stop · method · L381-L383 — stop()
- parseEntries · function · L388-L401 — function parseEntries(value: unknown): StreamEntry[]
- parseReadReply · function · L403-L408 — function parseReadReply(reply: unknown): StreamEntry[]
