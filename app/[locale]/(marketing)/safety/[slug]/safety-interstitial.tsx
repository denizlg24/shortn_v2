"use client";

import { useEffect, useState } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  ExternalLink,
  User as UserIcon,
  CalendarDays,
  Globe,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ReportDialog } from "./report-dialog";

const COUNTDOWN_SECONDS = 3;

type SafetyStatus = "pending" | "safe" | "suspicious" | "malicious" | "blocked";

function StatusBadge({ status }: { status: SafetyStatus }) {
  if (status === "suspicious") {
    return (
      <Badge variant="destructive" className="gap-1">
        <ShieldAlert className="size-3.5" />
        Suspicious
      </Badge>
    );
  }
  if (status === "safe") {
    return (
      <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600">
        <ShieldCheck className="size-3.5" />
        Safe
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <ShieldCheck className="size-3.5" />
      Checking…
    </Badge>
  );
}

export function SafetyInterstitial({
  slug,
  destinationUrl,
  destinationDomain,
  creatorName,
  createdAt,
  safetyStatus,
  riskScore,
}: {
  slug: string;
  destinationUrl: string;
  destinationDomain: string;
  creatorName: string | null;
  createdAt: string;
  safetyStatus: SafetyStatus;
  riskScore: number;
}) {
  const [remaining, setRemaining] = useState(COUNTDOWN_SECONDS);

  useEffect(() => {
    if (remaining <= 0) return;
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining]);

  const canContinue = remaining <= 0;
  const suspicious = safetyStatus === "suspicious";

  const formattedDate = new Date(createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-10">
      <Card className="w-full max-w-lg">
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-xl">You're leaving Shortn</CardTitle>
            <StatusBadge status={safetyStatus} />
          </div>
          <CardDescription>
            Review where this link is taking you before you continue.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {suspicious && (
            <Alert variant="destructive">
              <ShieldAlert className="size-4" />
              <AlertTitle>This destination looks suspicious</AlertTitle>
              <AlertDescription>
                Our automated checks flagged this link (risk score {riskScore}
                /100). Continue only if you trust the source.
              </AlertDescription>
            </Alert>
          )}

          <div className="rounded-lg border bg-muted/40 p-4 space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <Globe className="size-4 mt-0.5 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-muted-foreground">Destination domain</p>
                <p className="font-medium break-all">{destinationDomain}</p>
              </div>
            </div>
            <Separator />
            <div className="flex items-start gap-3">
              <ExternalLink className="size-4 mt-0.5 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-muted-foreground">Full URL</p>
                <p className="font-mono text-xs break-all">{destinationUrl}</p>
              </div>
            </div>
            {creatorName && (
              <>
                <Separator />
                <div className="flex items-start gap-3">
                  <UserIcon className="size-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-muted-foreground">Created by</p>
                    <p className="font-medium">{creatorName}</p>
                  </div>
                </div>
              </>
            )}
            <Separator />
            <div className="flex items-start gap-3">
              <CalendarDays className="size-4 mt-0.5 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-muted-foreground">Created on</p>
                <p className="font-medium">{formattedDate}</p>
              </div>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3 sm:flex-row">
          <Button
            asChild={canContinue}
            disabled={!canContinue}
            className="w-full sm:flex-1"
          >
            {canContinue ? (
              <a href={`/api/get-long-url/${slug}?c=1`} rel="nofollow noopener">
                Continue to Website
              </a>
            ) : (
              <span>Continue in {remaining}s…</span>
            )}
          </Button>
          <ReportDialog slug={slug} className="w-full sm:w-auto" />
        </CardFooter>
      </Card>
    </div>
  );
}
