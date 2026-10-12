# packages/ui/src/components/command.tsx

- Command · function · L11-L24 — function Command({ className, ...props }: ComponentProps<typeof CommandPrimitive>)
- CommandInput · function · L26-L53 — function CommandInput({ className, frameClassName, trailing, ...props }: ComponentProps<typeof CommandPrimitive.Input> & { trailing?: ReactNode; frameClassName?: string; })
- CommandList · function · L55-L68 — function CommandList({ className, ...props }: ComponentProps<typeof CommandPrimitive.List>)
- CommandEmpty · function · L70-L83 — function CommandEmpty({ className, ...props }: ComponentProps<typeof CommandPrimitive.Empty>)
- CommandGroup · function · L85-L98 — function CommandGroup({ className, ...props }: ComponentProps<typeof CommandPrimitive.Group>)
- CommandSeparator · function · L100-L110 — function CommandSeparator({ className, ...props }: ComponentProps<typeof CommandPrimitive.Separator>)
- CommandItem · function · L112-L151 — function CommandItem({ className, icon, shortcut, shortcutSequence, meta, children, ...props }: ComponentProps<typeof CommandPrimitive.Item> & { icon?: ReactNode; shortcut?: KeyboardHintProps["keys"]; shortcutSequence?: boolean; meta?: ReactNode; })
- CommandDialogProps · interface · L153-L159 — interface CommandDialogProps extends ComponentProps< typeof DialogPrimitive.Root >
- CommandDialog · function · L161-L194 — function CommandDialog({ title, footer, commandProps, children, ...props }: CommandDialogProps)
