# apps/web/src/components/qr/qr-image.tsx

- revokeLater · function · L8-L9 — revokeLater = (url: string)
- QrImage · function · L16-L113 — function QrImage({ options, size, alt, lazy = false, onRendered, className, }: { options: Options; /** Displayed size in CSS pixels; the drawing keeps its own resolution. */ size: number; alt: string; /** Waits until the image scrolls near the viewport (long grids). */ lazy?: boolean; onRendered?: (result: { logoFailed: boolean }) => void; className?: string; })
