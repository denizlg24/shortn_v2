# packages/ui/src/components/sheet.tsx

- SheetContentProps · interface · L15-L19 — interface SheetContentProps extends ComponentProps< typeof DialogPrimitive.Content >
- SheetContent · function · L21-L47 — function SheetContent({ className, children, side = "right", ...props }: SheetContentProps)
- SheetHeader · function · L49-L83 — function SheetHeader({ className, children, closable = true, }: { className?: string; children: ReactNode; closable?: boolean; })
- SheetTitle · function · L85-L98 — function SheetTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>)
- SheetDescription · function · L100-L110 — function SheetDescription({ className, ...props }: ComponentProps<typeof DialogPrimitive.Description>)
- SheetBody · function · L112-L122 — function SheetBody({ className, ...props }: ComponentProps<"div">)
- SheetFooter · function · L124-L134 — function SheetFooter({ className, ...props }: ComponentProps<"div">)
