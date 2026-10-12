# packages/db/migrations/runner.ts

- VerifyReport · interface · L15-L20 — interface VerifyReport
- BatchOptions · interface · L21-L32 — interface BatchOptions
- MigrationContext · interface · L33-L46 — interface MigrationContext
- Migration · interface · L47-L56 — interface Migration
- MigrationState · interface · L57-L71 — interface MigrationState
- RunnerOptions · interface · L72-L83 — interface RunnerOptions
- validateOptions · function · L84-L129 — function validateOptions( migrations: Migration[], options: RunnerOptions, ): Migration[]
- assertReadPipeline · function · L131-L141 — function assertReadPipeline(value: unknown): void
- compareAndSet · function · L143-L168 — function compareAndSet( source: Document, fields: string[], update: UpdateFilter<Document>, ): AnyBulkWriteOperation<Document>
- operationSummary · function · L170-L201 — function operationSummary(operation: AnyBulkWriteOperation<Document>)
- runMigrations · function · L203-L645 — async function runMigrations( client: MongoClient, db: Db, migrations: Migration[], options: RunnerOptions = {}, ): Promise<Record<string, VerifyReport>>
- assertLease · function · L225-L229 — assertLease = async ()
- fence · function · L230-L235 — fence = async (session: ClientSession)
- transaction · function · L236-L248 — transaction = async <T>( work: (session: ClientSession) => Promise<T>, ): Promise<T>
- writeState · function · L249-L257 — writeState = async ( id: string, update: UpdateFilter<MigrationState>, upsert = false, )
- processBatch · function · L353-L506 — processBatch = async ( batch: BatchOptions, archiveTarget?: string, ): Promise<number>
- readBatch · function · L391-L418 — readBatch = async (session?: ClientSession)
- checkpoint · function · L419-L428 — checkpoint = async ( nextId: ObjectId, session: ClientSession, )
