# apps/worker/src/jobs.ts

- TrimClient · type · L10-L10 — type TrimClient = Pick<Redis, "xinfo" | "xpending" | "xtrim">;
- field · function · L12-L15 — function field(reply: unknown[], name: string): unknown
- compareIds · function · L17-L21 — function compareIds(a: string, b: string)
- trimStream · function · L26-L55 — async function trimStream( redis: TrimClient, ): Promise<string | undefined>
- refreshRecentRollups · function · L57-L60 — async function refreshRecentRollups(db: Db, now = new Date())
- fillEventWorkspaces · function · L63-L88 — async function fillEventWorkspaces(db: Db)
- runContinuousMigrations · function · L92-L123 — async function runContinuousMigrations( client: MongoClient, db: Db, migrations: Migration[], log: (message: string) => void, )
- every · function · L125-L145 — function every( ms: number, name: string, job: () => Promise<unknown>, log: (message: string, error?: unknown) => void, )
- tick · function · L132-L142 — tick = async ()
