# apps/web/src/components/qr/qr-scan-check.ts

- Rgba · interface · L3-L9 — interface Rgba
- channel · function · L21-L26 — channel = (raw: string, max: number)
- parseColor · function · L29-L56 — function parseColor(input: string): Rgba | null
- linear · function · L58-L61 — linear = (value: number)
- luminance · function · L64-L65 — luminance = ({ r, g, b }: Rgba)
- over · function · L67-L72 — over = (top: Rgba, bottom: Rgba): Rgba
- ContrastTone · type · L76-L76 — type ContrastTone = "ok" | "warning" | "danger";
- contrastTone · function · L81-L82 — contrastTone = (difference: number): ContrastTone
- ScanIssue · type · L84-L91 — type ScanIssue = | { kind: "contrast"; tone: ContrastTone; difference: number } | { kind: "unknownColor" } | { kind: "inverted" } | { kind: "transparent" } | { kind: "logoLarge"; share: number } | { kind: "logoSmall" } | { kind: "logoUnavailable" };
- ScanInput · interface · L93-L102 — interface ScanInput
- scanIssues · function · L110-L149 — function scanIssues(input: ScanInput): ScanIssue[]
- rank · function · L140-L147 — rank = (issue: ScanIssue)
