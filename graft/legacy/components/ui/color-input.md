# legacy/components/ui/color-input.tsx

- ColorPickerProps · interface · L39-L49 — interface ColorPickerProps
- ColorValues · interface · L51-L57 — interface ColorValues
- InputColor · function · L59-L546 — function InputColor({ value, onChange, onBlur, isLoading = false, label, error, className = "mt-6", alpha = false, size, }: ColorPickerProps)
- updateColorValues · function · L97-L119 — updateColorValues = (newColor: string)
- handleColorChange · function · L122-L125 — handleColorChange = (newColor: string)
- handleHexChange · function · L128-L162 — handleHexChange = (value: string)
- handleRgbChange · function · L165-L174 — handleRgbChange = (component: "r" | "g" | "b", value: string)
- handleRgbaChange · function · L177-L205 — handleRgbaChange = ( component: "r" | "g" | "b" | "a", value: string, )
- handleHslChange · function · L208-L222 — handleHslChange = (component: "h" | "s" | "l", value: string)
- handleHslaChange · function · L225-L255 — handleHslaChange = ( component: "h" | "s" | "l" | "a", value: string, )
- handlePopoverChange · function · L258-L263 — handlePopoverChange = (open: boolean)
- isEyeDropperAvailable · function · L266-L268 — isEyeDropperAvailable = ()
- handleEyeDropper · function · L271-L286 — handleEyeDropper = async ()
- getCurrentHexValue · function · L296-L309 — getCurrentHexValue = ()
