# packages/ui/scripts/color-math.ts

- Oklch · interface · L1-L6 — interface Oklch
- Vec3 · type · L8-L8 — type Vec3 = [number, number, number];
- clamp01 · function · L10-L10 — clamp01 = (x: number)
- oklchToOklab · function · L12-L15 — function oklchToOklab({ l, c, h }: Oklch): Vec3
- oklabToLinearSrgb · function · L17-L26 — function oklabToLinearSrgb([L, a, b]: Vec3): Vec3
- linearSrgbToOklab · function · L28-L37 — function linearSrgbToOklab([r, g, b]: Vec3): Vec3
- isInGamut · function · L39-L39 — isInGamut = (v: Vec3)
- inSrgbGamut · function · L41-L43 — function inSrgbGamut(color: Oklch): boolean
- toLinearSrgb · function · L46-L60 — function toLinearSrgb(color: Oklch): Vec3
- encode · function · L62-L63 — encode = (x: number)
- decode · function · L64-L65 — decode = (x: number)
- flatten · function · L67-L73 — function flatten(top: Oklch, under: Oklch): Vec3
- luminance · function · L75-L75 — luminance = ([r, g, b]: Vec3)
- contrastRatio · function · L77-L82 — function contrastRatio(fg: Oklch, bg: Oklch): number
- Vision · type · L103-L103 — type Vision = "normal" | keyof typeof CVD_MATRICES;
- simulate · function · L111-L117 — function simulate(lin: Vec3, vision: Vision): Vec3
- closestPair · function · L119-L137 — function closestPair( colors: Oklch[], vision: Vision, ): { delta: number; pair: [number, number] }
