# legacy/components/DotGrid.tsx

- throttle · function · L8-L17 — throttle = (func: (...args: unknown[]) => void, limit: number)
- Dot · interface · L19-L25 — interface Dot
- DotGridProps · interface · L27-L41 — interface DotGridProps
- hexToRgb · function · L43-L51 — function hexToRgb(hex: string)
- DotGrid · function · L53-L304 — DotGrid: React.FC<DotGridProps> = ({ dotSize = 16, gap = 32, baseColor = "#5227FF", activeColor = "#5227FF", proximity = 150, speedTrigger = 100, shockRadius = 250, shockStrength = 5, maxSpeed = 5000, resistance = 750, returnDuration = 1.5, className = "", style, })
- draw · function · L138-L172 — draw = ()
- onMove · function · L196-L243 — onMove = (e: MouseEvent)
- onClick · function · L245-L271 — onClick = (e: MouseEvent)
