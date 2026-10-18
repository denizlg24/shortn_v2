import { useId, useState, type ChangeEvent, type FormEvent } from "react";
import { flushSync } from "react-dom";

export type FieldErrors<F extends string> = { [K in F]?: string | undefined };

/** `navigating` keeps the submit button busy until the page unloads. */
export type SubmitOutcome<F extends string> =
  "done" | "navigating" | { field: F; error: string } | { formError: string };

interface Options {
  /** Shown when the request throws (offline, DNS, CORS). */
  fallbackError: string;
  initialFormError?: string | null;
}

export function useAuthForm<F extends string>(
  initial: Record<F, string>,
  validate: (values: Record<F, string>) => FieldErrors<F>,
  { fallbackError, initialFormError = null }: Options,
) {
  const prefix = useId();
  const [values, setValues] = useState(initial);
  const [touched, setTouched] = useState<{ [K in F]?: boolean }>({});
  const [attempted, setAttempted] = useState(false);
  const [serverErrors, setServerErrors] = useState<FieldErrors<F>>({});
  const [formError, setFormError] = useState<string | null>(initialFormError);
  const [pending, setPending] = useState(false);

  const clientErrors = validate(values);
  const hasClientErrors = Object.values(clientErrors).some(Boolean);

  const id = (name: F) => `${prefix}-${name}`;

  const errorFor = (name: F): string | undefined =>
    serverErrors[name] ??
    (attempted || touched[name] ? clientErrors[name] : undefined);

  const setValue = (name: F, value: string) => {
    setValues((previous) => ({ ...previous, [name]: value }));
    setServerErrors((previous) => ({ ...previous, [name]: undefined }));
    setFormError(null);
  };

  const field = (name: F) => ({
    id: id(name),
    name,
    value: values[name],
    onChange: (event: ChangeEvent<HTMLInputElement>) =>
      setValue(name, event.target.value),
    onBlur: () =>
      setTouched((previous) =>
        previous[name] ? previous : { ...previous, [name]: true },
      ),
  });

  const submit =
    (action: (values: Record<F, string>) => Promise<SubmitOutcome<F>>) =>
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (pending) return;
      const form = event.currentTarget;
      const focusFirstInvalid = () =>
        form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();

      flushSync(() => {
        setAttempted(true);
        setFormError(null);
      });
      if (hasClientErrors) {
        focusFirstInvalid();
        return;
      }

      setPending(true);
      let outcome: SubmitOutcome<F>;
      try {
        outcome = await action(values);
      } catch {
        outcome = { formError: fallbackError };
      }
      if (outcome === "navigating") return;
      // Errors are applied in the same synchronous render so focus can follow them.
      const result = outcome;
      flushSync(() => {
        setPending(false);
        if (result === "done") return;
        if ("field" in result)
          setServerErrors((previous) => ({
            ...previous,
            [result.field]: result.error,
          }));
        else setFormError(result.formError);
      });
      focusFirstInvalid();
    };

  return {
    values,
    pending,
    formError,
    id,
    field,
    errorFor,
    setValue,
    setFormError,
    submit,
  };
}
