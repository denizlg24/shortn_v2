"use client";

import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  Input,
  Label,
} from "@shortn/ui";
import { useTranslations } from "next-intl";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { FormAlert } from "@/components/auth/auth-parts";

/**
 * Destructive confirmation (12: dialogs are reserved for these). `onConfirm`
 * resolves to an error message to keep the dialog open, or null when done.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  typedConfirmation,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description: ReactNode;
  confirmLabel: string;
  /** Require typing this exact text before the action unlocks. */
  typedConfirmation?: { value: string; label: ReactNode };
  onConfirm: () => Promise<string | null>;
}) {
  const t = useTranslations("settings.common");
  const inputId = useId();
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked =
    typedConfirmation !== undefined && typed.trim() !== typedConfirmation.value;

  const change = (next: boolean) => {
    if (pending) return;
    if (!next) {
      setTyped("");
      setError(null);
    }
    onOpenChange(next);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (locked || pending) return;
    setPending(true);
    setError(null);
    let failure: string | null;
    try {
      failure = await onConfirm();
    } catch {
      failure = t("errors.network");
    }
    setPending(false);
    if (failure) setError(failure);
  };

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent>
        <DialogHeader title={title} description={description} />
        <form onSubmit={submit} className="flex flex-col gap-4">
          {typedConfirmation ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={inputId} className="font-normal text-fg-muted">
                {typedConfirmation.label}
              </Label>
              <Input
                id={inputId}
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                autoFocus
              />
            </div>
          ) : null}
          {error ? <FormAlert>{error}</FormAlert> : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button disabled={pending}>{t("cancel")}</Button>
            </DialogClose>
            <Button
              type="submit"
              variant="danger"
              loading={pending}
              disabled={locked}
            >
              {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
