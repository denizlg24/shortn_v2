# legacy/components/LightRays.tsx

- RaysOrigin · type · L5-L13 — type RaysOrigin = | "top-center" | "top-left" | "top-right" | "right" | "left" | "bottom-center" | "bottom-right" | "bottom-left";
- LightRaysProps · interface · L15-L29 — interface LightRaysProps
- hexToRgb · function · L33-L42 — hexToRgb = (hex: string): [number, number, number]
- getAnchorAndDir · function · L44-L68 — getAnchorAndDir = ( origin: RaysOrigin, w: number, h: number, ): { anchor: [number, number]; dir: [number, number] }
- Vec2 · type · L70-L70 — type Vec2 = [number, number];
- Vec3 · type · L71-L71 — type Vec3 = [number, number, number];
- Uniforms · interface · L73-L89 — interface Uniforms
- LightRays · function · L91-L468 — LightRays: React.FC<LightRaysProps> = ({ raysOrigin = "top-center", raysColor = DEFAULT_COLOR, raysSpeed = 1, lightSpread = 1, rayLength = 2, pulsating = false, fadeDistance = 1.0, saturation = 1.0, followMouse = true, mouseInfluence = 0.1, noiseAmount = 0.0, distortion = 0.0, className = "", })
- initializeWebGL · function · L146-L384 — initializeWebGL = async ()
- updatePlacement · function · L300-L317 — updatePlacement = ()
- loop · function · L319-L349 — loop = (t: number)
- handleMouseMove · function · L448-L454 — handleMouseMove = (e: MouseEvent)
