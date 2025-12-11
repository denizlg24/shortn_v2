"use client";

import { ArrowRight, CheckCircle2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { useLocale } from "next-intl";

interface SubscriptionSuccessProps {
  plan: string;
  type?: "upgrade" | "subscribe";
}

export function UpgradedCard({
  plan,
  type = "subscribe",
}: SubscriptionSuccessProps) {
  const locale = useLocale();
  async function handleNavigate(path: string) {
    window.location.href = `/${locale}${path}`;
  }
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className="relative"
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <Card className="max-w-lg text-center shadow-2xl border-border/40 bg-linear-to-b from-background to-muted mx-auto">
        <CardHeader>
          <div className="flex justify-center mb-2">
            <motion.div
              initial={{ rotate: -10, scale: 0 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 120, damping: 12 }}
            >
              <CheckCircle2 className="h-16 w-16 text-green-500" />
            </motion.div>
          </div>
          <CardTitle className="text-2xl font-bold">
            {type === "upgrade"
              ? "Your Plan Was Upgraded!"
              : "Welcome to Your New Plan!"}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-base">
            You’re now on the{" "}
            <span className="font-semibold text-foreground capitalize">
              {plan}
            </span>{" "}
            plan. Enjoy your new features and benefits!
          </p>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="flex items-center justify-center gap-2 rounded-lg border p-3 bg-muted/30 text-sm text-muted-foreground text-left"
          >
            <span>
              If your subscription changes haven&apos;t taken effect yet, please
              refresh your dashboard.
            </span>
          </motion.div>

          <Button
            onClick={() => handleNavigate("/dashboard/settings/plan")}
            className="mt-4 w-full max-w-full!"
          >
            Manage plan <ArrowRight />
          </Button>
          <p className="text-xs italic text-muted-foreground w-full">
            Invoice and payment details are available on your{" "}
            <Button
              variant={"link"}
              onClick={() => handleNavigate("/dashboard/settings/billing")}
              className="text-xs italic text-muted-foreground p-0! w-fit! h-fit! font-semibold underline "
            >
              Billing Page <ExternalLink />
            </Button>
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
