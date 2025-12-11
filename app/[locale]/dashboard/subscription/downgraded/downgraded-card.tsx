"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { ArrowRight } from "lucide-react";

export const DowngradedCard = ({ plan }: { plan: string }) => {
  return (
    <Card className="max-w-md! w-full border-border/50 shadow-sm mt-8">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">
          Your plan has been downgraded
        </CardTitle>
        <CardDescription>
          We&apos;re sorry to see you step down — but we appreciate you staying
          with us.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">
          You've successfully moved to the{" "}
          <span className="font-medium text-foreground capitalize">{plan}</span>{" "}
          plan.
        </div>

        <div className="rounded-lg border p-3 bg-muted/30 text-sm text-muted-foreground">
          If your subscription changes haven&apos;t taken effect yet, please
          refresh your dashboard.
        </div>

        <Button asChild className="w-full max-w-full!">
          <Link href={"/dashboard/settings/plan"}>
            Manage plan <ArrowRight />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
};
