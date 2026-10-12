# apps/redirect/src/clicks.ts

- StreamWriter · interface · L7-L9 — interface StreamWriter
- Enqueue · type · L11-L11 — type Enqueue = (message: ClickMessage) => void;
- createClickQueue · function · L16-L105 — function createClickQueue( stream: StreamWriter, spoolPath: string, log: (message: string) => void = console.error, )
- write · function · L25-L27 — write = async (message: ClickMessage)
- spool · function · L29-L37 — spool = async (message: ClickMessage)
- persist · function · L39-L50 — persist = async ()
- drain · function · L52-L72 — drain = ()
- enqueue · function · L74-L81 — enqueue: Enqueue = (message)
- spooled · method · L86-L88 — get spooled()
- load · method · L89-L103 — async load()
