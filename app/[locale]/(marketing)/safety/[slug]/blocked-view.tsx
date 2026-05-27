import { ShieldX } from "lucide-react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function reasonLabel(reason?: string): string {
  if (!reason) return "This link was disabled by our automated safety systems.";
  if (reason.startsWith("auto:report-threshold")) {
    return "This link was disabled after multiple abuse reports from users.";
  }
  if (
    reason.startsWith("auto:malicious-score") ||
    reason.startsWith("structural:")
  ) {
    return "This link was flagged as malicious by our automated safety checks.";
  }
  return "This link was disabled by our moderation team.";
}

export function BlockedView({
  slug,
  reason,
}: {
  slug: string;
  reason?: string;
}) {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-10">
      <Card className="w-full max-w-lg border-destructive/40">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10">
            <ShieldX className="size-6 text-destructive" />
          </div>
          <CardTitle className="text-xl">
            Link blocked for your safety
          </CardTitle>
          <CardDescription>{reasonLabel(reason)}</CardDescription>
        </CardHeader>
        <CardContent className="text-center text-sm text-muted-foreground">
          <p>
            Shortn will not redirect you to this destination. If you believe
            this is a mistake, you can appeal through our abuse team.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/abuse">Read our Abuse Policy</Link>
          </Button>
          <Button asChild className="w-full sm:w-auto">
            <a
              href={`mailto:abuse@shortn.at?subject=Appeal%20for%20blocked%20link%20${slug}`}
            >
              Contact abuse team
            </a>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
