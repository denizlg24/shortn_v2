# apps/web/src/components/qr/qr-options.ts

- Stored · type · L18-L18 — type Stored = Record<string, unknown>;
- isRecord · function · L20-L21 — isRecord = (value: unknown): value is Stored
- text · function · L23-L24 — text = (value: unknown)
- number · function · L27-L33 — number = (value: unknown)
- flag · function · L35-L36 — flag = (value: unknown)
- oneOf · function · L38-L39 — oneOf = <T extends string>(options: readonly T[], value: unknown)
- gradientOf · function · L48-L66 — function gradientOf(value: unknown): Gradient | undefined
- group · function · L68-L71 — group = (stored: Stored, key: string): Stored
- paint · function · L73-L82 — function paint<T extends string>(part: Stored, types: readonly T[])
- printedOptions · function · L88-L140 — function printedOptions(stored: Stored, data: string): Options
- mergeDesign · function · L146-L154 — function mergeDesign(stored: Stored, edit: QrDesign): Stored
- GradientPart · type · L162-L162 — type GradientPart = (typeof gradientParts)[number];
- gradientsIn · function · L165-L166 — gradientsIn = (stored: Stored): GradientPart[]
- printedSize · function · L169-L172 — printedSize = (stored: Stored)
