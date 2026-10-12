# legacy/components/ui/chart.tsx

- ChartConfig · type · L15-L24 — type ChartConfig = Record< string, { label?: React.ReactNode; icon?: React.ComponentType; } & ( | { color?: string; theme?: never } | { color?: never; theme: Record<keyof typeof THEMES, string> } ) >;
- ChartContextProps · interface · L26-L28 — interface ChartContextProps
- useChart · function · L32-L40 — function useChart()
- ChartContainer · function · L42-L75 — function ChartContainer({ id, className, children, config, ...props }: React.ComponentProps<"div"> & { config: ChartConfig; children: React.ComponentProps< typeof RechartsPrimitive.ResponsiveContainer >["children"]; })
- ChartStyle · function · L77-L108 — ChartStyle = ({ id, config }: { id: string; config: ChartConfig })
- ChartTooltipContent · function · L112-L259 — function ChartTooltipContent({ active, className, indicator = "dot", hideLabel = false, hideIndicator = false, labelFormatter, labelClassName, formatter, color, nameKey, labelKey, payload, label, }: React.ComponentProps<typeof RechartsPrimitive.Tooltip> & React.ComponentProps<"div"> & { hideLabel?: boolean; hideIndicator?: boolean; indicator?: "line" | "dot" | "dashed"; nameKey?: string; labelKey?: string; } & Omit< RechartsPrimitive.DefaultTooltipContentProps<ValueType, NameType>, "accessibilityLayer" >)
- ChartLegendContent · function · L263-L314 — function ChartLegendContent({ className, hideIcon = false, nameKey, payload, verticalAlign, }: React.ComponentProps<"div"> & { hideIcon?: boolean; nameKey?: string; } & RechartsPrimitive.DefaultLegendContentProps)
- getPayloadConfigFromPayload · function · L317-L351 — function getPayloadConfigFromPayload( config: ChartConfig, payload: unknown, key: string, )
