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

const cancellationReasons = [
  { value: "too_expensive", label: "Too expensive" },
  { value: "missing_features", label: "Missing features" },
  { value: "switched_service", label: "Switched to another service" },
  { value: "unused", label: "Not using the service" },
  { value: "customer_service", label: "Customer service issues" },
  { value: "low_quality", label: "Quality below expectations" },
  { value: "too_complex", label: "Too complex to use" },
  { value: "other", label: "Other" },
];

export const CancelSubscriptionButton = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState<string>("");
  const [comment, setComment] = useState<string>("");
  const router = useRouter();

  const handleCancel = async () => {
    if (!reason) {
      setError("Please select a reason for cancellation");
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
        // Redirect to cancellation success page
        router.push(
          `/dashboard/subscription/canceled?scheduled=${data.scheduledFor}`,
        );
      } else {
        setError(
          data.message || "Failed to schedule cancellation. Please try again.",
        );
      }
    } catch (error) {
      console.error("Failed to schedule cancellation:", error);
      setError(
        "An unexpected error occurred. Please try again or contact support.",
      );
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
            Cancel Subscription
          </DialogTitle>
          <DialogDescription className="text-center pt-2">
            We're sorry to see you go. Your subscription will be set to cancel
            at the end of your current billing period, and you'll continue to
            have access to all features until then.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Reason Selection */}
          <div className="space-y-2">
            <Label htmlFor="reason">
              Reason for cancellation <span className="text-red-500">*</span>
            </Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="w-full" id="reason">
                <SelectValue placeholder="Select a reason" />
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

          {/* Comment/Feedback */}
          <div className="space-y-2">
            <Label htmlFor="comment">Additional feedback (optional)</Label>
            <Textarea
              id="comment"
              placeholder="Help us improve by sharing more details..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              {comment.length}/500 characters
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
                Processing...
              </>
            ) : (
              "Confirm Cancellation"
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
            className="w-full"
            size="lg"
          >
            Keep My Subscription
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Cancellation takes effect at the end of your billing period
        </p>
      </DialogContent>
    </Dialog>
  );
};
