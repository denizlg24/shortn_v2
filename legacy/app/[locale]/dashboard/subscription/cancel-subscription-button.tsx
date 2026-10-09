"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, AlertCircle, XCircle } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useTranslations } from "next-intl";

const cancellationReasonKeys = [
  "too_expensive",
  "missing_features",
  "switched_service",
  "unused",
  "customer_service",
  "low_quality",
  "too_complex",
  "other",
] as const;

export const CancelSubscriptionButton = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const t = useTranslations("cancel-button");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState<string>("");
  const [comment, setComment] = useState<string>("");
  const router = useRouter();

  const cancellationReasons = cancellationReasonKeys.map((key) => ({
    value: key,
    label: t(`reasons.${key}`),
  }));

  const handleCancel = async () => {
    if (!reason) {
      setError(t("error-select-reason"));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/polar/schedule-cancellation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason, comment }),
      });

      const data = await response.json();

      if (data.success) {
        console.log("Scheduled cancellation:", data);
        setOpen(false);
        router.push(
          `/dashboard/subscription/canceled?scheduled=${data.scheduledFor}`,
        );
      } else {
        setError(data.message || t("error-default"));
      }
    } catch (error) {
      console.error("Failed to schedule cancellation:", error);
      setError(t("error-unexpected"));
    }

    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <XCircle className="h-6 w-6 text-red-600" />
          </div>
          <DialogTitle className="text-center text-xl">
            {t("title")}
          </DialogTitle>
          <DialogDescription className="text-center pt-2">
            {t("description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reason">
              {t("reason-label")}{" "}
              <span className="text-red-500">{t("required")}</span>
            </Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="w-full" id="reason">
                <SelectValue placeholder={t("reason-placeholder")} />
              </SelectTrigger>
              <SelectContent className="z-99">
                {cancellationReasons.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="comment">{t("feedback-label")}</Label>
            <Textarea
              id="comment"
              placeholder={t("feedback-placeholder")}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              {t("characters", { count: comment.length })}
            </p>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          <Button
            onClick={handleCancel}
            disabled={loading}
            variant="destructive"
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("processing")}
              </>
            ) : (
              t("confirm")
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
            className="w-full"
            size="lg"
          >
            {t("keep")}
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground">{t("note")}</p>
      </DialogContent>
    </Dialog>
  );
};
