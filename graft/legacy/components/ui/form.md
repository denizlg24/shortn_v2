# legacy/components/ui/form.tsx

- FormFieldContextValue · type · L21-L26 — type FormFieldContextValue< TFieldValues extends FieldValues = FieldValues, TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues> > = { name: TName; };
- FormField · function · L32-L43 — FormField = < TFieldValues extends FieldValues = FieldValues, TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues> >({ ...props }: ControllerProps<TFieldValues, TName>)
- useFormField · function · L45-L66 — useFormField = ()
- FormItemContextValue · type · L68-L70 — type FormItemContextValue = { id: string; };
- FormItem · function · L76-L88 — function FormItem({ className, ...props }: React.ComponentProps<"div">)
- FormLabel · function · L90-L105 — function FormLabel({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>)
- FormControl · function · L107-L124 — function FormControl({ ...props }: React.ComponentProps<typeof Slot>)
- FormDescription · function · L126-L137 — function FormDescription({ className, ...props }: React.ComponentProps<"p">)
- FormMessage · function · L139-L157 — function FormMessage({ className, ...props }: React.ComponentProps<"p">)
