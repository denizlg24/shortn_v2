# apps/web/src/components/qr/qr-render.ts

- loadStyling · function · L9-L10 — loadStyling = ()
- scaled · function · L13-L30 — function scaled(options: Options, size: number): Options
- logoLoads · function · L36-L63 — function logoLoads(url: string): Promise<boolean>
- withTimeout · function · L65-L82 — function withTimeout<T>(promise: Promise<T>): Promise<T>
- Format · type · L84-L84 — type Format = "svg" | "png" | "jpeg";
- render · function · L86-L91 — async function render(options: Options, format: Format): Promise<Blob>
- Rendered · interface · L93-L97 — interface Rendered
- renderQrUrl · function · L100-L105 — async function renderQrUrl(options: Options): Promise<Rendered>
- DownloadResult · type · L107-L107 — type DownloadResult = "done" | "logo_failed" | "failed";
- downloadQr · function · L109-L133 — async function downloadQr( options: Options, format: Format, name: string, ): Promise<DownloadResult>
