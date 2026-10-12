# legacy/components/ui/command.tsx

- Command · function · L16-L30 — function Command({ className, ...props }: React.ComponentProps<typeof CommandPrimitive>)
- CommandDialog · function · L32-L61 — function CommandDialog({ title = "Command Palette", description = "Search for a command to run...", children, className, showCloseButton = true, ...props }: React.ComponentProps<typeof Dialog> & { title?: string description?: string className?: string showCloseButton?: boolean })
- CommandInput · function · L63-L83 — function CommandInput({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Input>)
- CommandList · function · L85-L99 — function CommandList({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.List>)
- CommandEmpty · function · L101-L111 — function CommandEmpty({ ...props }: React.ComponentProps<typeof CommandPrimitive.Empty>)
- CommandGroup · function · L113-L127 — function CommandGroup({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Group>)
- CommandSeparator · function · L129-L140 — function CommandSeparator({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Separator>)
- CommandItem · function · L142-L156 — function CommandItem({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Item>)
- CommandShortcut · function · L158-L172 — function CommandShortcut({ className, ...props }: React.ComponentProps<"span">)
