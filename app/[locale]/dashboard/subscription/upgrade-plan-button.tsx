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
import { Loader2, TrendingUp, AlertCircle } from "lucide-react";
import { Subscription } from "@polar-sh/sdk/models/components/subscription.js";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const UpgradeSessionButton = ({
  slug,
  children,
  downgrade = false,
}: {
  slug: "pro" | "plus" | "basic";
  children: React.ReactNode;
  downgrade?: boolean;
}) => {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  if (downgrade) {
    return (
      <div
        className="w-full"
        onClick={() =>
          router.push(`/dashboard/subscription/subscribe?tier=${slug}`)
        }
      >
        {children}
      </div>
    );
  }

  const handleClick = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/polar/create-update-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ slug, downgrade: false }),
      });
      const data = await response.json();

      if (data.success && data.subscription) {
        const subscription = data.subscription as Subscription;
        console.log("Updated subscription:", subscription);
        setOpen(false);
        // Redirect to success page with signed subscription ID
        router.push(
          `/dashboard/subscription/success?sid=${subscription.id}&sig=${data.signature}&action=upgrade`,
        );
      } else if (data.paymentFailed) {
        // Payment failed - redirect to failure page
        setOpen(false);
        router.push(`/dashboard/subscription/success?status=payment_failed`);
      } else {
        // Handle other API error responses
        setError(
          data.message || "Failed to update subscription. Please try again.",
        );
      }
    } catch (error) {
      console.error("Failed to update subscription:", error);
      setError(
        "An unexpected error occurred. Please try again or contact support.",
      );
    }
    setLoading(false);
  };

  const planNames = {
    basic: "Basic",
    plus: "Plus",
    pro: "Pro",
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <TrendingUp className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center text-xl">
            Upgrade Plan
          </DialogTitle>
          <DialogDescription className="text-center pt-2">
            You're about to upgrade to the{" "}
            <span className="font-semibold text-foreground">
              {planNames[slug]}
            </span>{" "}
            plan. You'll be invoiced for the prorated difference based on your
            remaining billing period, and your new features will be available
            immediately.
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
            onClick={handleClick}
            disabled={loading}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              "Confirm Upgrade"
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
          Charges appear on your next statement
        </p>
      </DialogContent>
    </Dialog>
  );
};
