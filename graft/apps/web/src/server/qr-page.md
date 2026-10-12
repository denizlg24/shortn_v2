# apps/web/src/server/qr-page.ts

- qrName · function · L15-L15 — qrName = (qr: Pick<QrView, "title" | "key">)
- QrTab · type · L17-L17 — type QrTab = "overview" | "design" | "analytics" | "edit";
- qrTabs · function · L20-L33 — qrTabs = ( workspace: string, id: string, editable: boolean, label: (key: QrTab) => string, )
