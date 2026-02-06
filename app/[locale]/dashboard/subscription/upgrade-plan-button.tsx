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
import { useTranslations } from "next-intl";

export const UpgradeSessionButton = ({
  slug,
  children,
  downgrade = false,
}: {
  slug: "pro" | "plus" | "basic";
  children: React.ReactNode;
  downgrade?: boolean;
}) => {
  const t = useTranslations("upgrade-button");
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

        router.push(
          `/dashboard/subscription/success?sid=${subscription.id}&sig=${data.signature}&action=upgrade`,
        );
      } else if (data.paymentFailed) {
        setOpen(false);
        router.push(`/dashboard/subscription/success?status=payment_failed`);
      } else {
        setError(data.message || t("error-default"));
      }
    } catch (error) {
      console.error("Failed to update subscription:", error);
      setError(t("error-unexpected"));
    }
    setLoading(false);
  };

  const planNames = {
    basic: t("plans.basic"),
    plus: t("plans.plus"),
    pro: t("plans.pro"),
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
            {t("title")}
          </DialogTitle>
          <DialogDescription className="text-center pt-2">
            {t.rich("description", {
              plan: planNames[slug],
              strong: (chunks) => (
                <span className="font-semibold text-foreground">{chunks}</span>
              ),
            })}
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
            {t("cancel")}
          </Button>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          {t("note")}
        </p>
      </DialogContent>
    </Dialog>
  );
};
