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
import { Loader2, AlertCircle, RotateCcw } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PendingChange {
  _id: string;
  changeType: "cancellation" | "downgrade";
  currentPlan: string;
  targetPlan: string;
  scheduledFor: string;
  reason?: string;
  comment?: string;
}

export const RevertScheduledChangeButton = ({
  children,
  pendingChange,
  onRevertSuccess,
}: {
  children: React.ReactNode;
  pendingChange: PendingChange;
  onRevertSuccess?: () => void;
}) => {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleRevert = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/polar/revert-scheduled-change", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (data.success) {
        console.log("Reverted scheduled change:", data);
        setOpen(false);

        if (onRevertSuccess) {
          onRevertSuccess();
        }

        router.refresh();
      } else {
        setError(data.message || "Failed to revert change. Please try again.");
      }
    } catch (error) {
      console.error("Failed to revert scheduled change:", error);
      setError(
        "An unexpected error occurred. Please try again or contact support.",
      );
    }

    setLoading(false);
  };

  const scheduledDate = new Date(pendingChange.scheduledFor);
  const formattedDate = scheduledDate.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const changeTypeLabel =
    pendingChange.changeType === "cancellation"
      ? "cancellation"
      : `downgrade to ${pendingChange.targetPlan}`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <RotateCcw className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center text-xl">
            Revert Scheduled{" "}
            {pendingChange.changeType === "cancellation"
              ? "Cancellation"
              : "Downgrade"}
          </DialogTitle>
          <DialogDescription className="text-center pt-2">
            You have a scheduled {changeTypeLabel} set for{" "}
            <span className="font-semibold text-foreground">
              {formattedDate}
            </span>
            . Would you like to revert this change and keep your current plan?
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="mt-6 flex flex-col gap-3">
          <Button
            onClick={handleRevert}
            disabled={loading}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Reverting...
              </>
            ) : (
              "Yes, Revert Change"
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
            className="w-full"
            size="lg"
          >
            Cancel
          </Button>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          This will restore your subscription to its current active state.
        </p>
      </DialogContent>
    </Dialog>
  );
};
