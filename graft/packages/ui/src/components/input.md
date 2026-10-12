# packages/ui/src/components/input.tsx

- InputProps · interface · L21-L27 — interface InputProps extends Omit<ComponentProps<"input">, "size">
- Input · function · L29-L66 — function Input({ size = "md", leading, trailing, frameClassName, className, ...props }: InputProps)
- Textarea · function · L68-L80 — function Textarea({ className, ...props }: ComponentProps<"textarea">)
- Label · function · L82-L89 — function Label({ className, ...props }: ComponentProps<"label">)
- FieldProps · interface · L91-L98 — interface FieldProps
- Field · function · L100-L123 — function Field({ label, htmlFor, hint, error, className, children, }: FieldProps)
