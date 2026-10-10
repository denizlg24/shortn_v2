"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@shortn/ui";
import { useTranslations } from "next-intl";
import { useState } from "react";

/** Destructive confirmation (12: dialogs are reserved for this). */
export function DeleteDialog({
  target,
  onOpenChange,
  onConfirm,
}: {
  /** `deletable` is the subset of `count` the viewer may delete. */
  target: { count: number; deletable: number } | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<string | null>;
}) {
  const t = useTranslations("links.delete");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const count = target?.count ?? 0;
  const deletable = target?.deletable ?? 0;

  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open) => {
        if (pending) return;
        if (!open) setError(null);
        onOpenChange(open);
      }}
    >
      <DialogContent>
        <DialogHeader
          title={
            deletable === 0 ? t("noneTitle") : t("title", { count: deletable })
          }
          description={
            deletable === 0
              ? t("none")
              : deletable < count
                ? t("partial", { deletable, count })
                : t("body")
          }
        />
        {error ? (
          <p role="alert" className="text-small text-danger">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            {t("cancel")}
          </Button>
          {deletable > 0 ? (
            <Button
              variant="danger"
              loading={pending}
              onClick={async () => {
                setPending(true);
                const failure = await onConfirm();
                setPending(false);
                setError(failure);
              }}
            >
              {t("confirm", { count: deletable })}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
