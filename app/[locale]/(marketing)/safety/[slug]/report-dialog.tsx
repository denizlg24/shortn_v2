"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { reportLink } from "@/app/actions/reportActions";
import type { ReportReason } from "@/models/url/LinkReport";

const REASONS: { value: ReportReason; label: string }[] = [
  { value: "phishing", label: "Phishing / impersonation" },
  { value: "malware", label: "Malware / virus" },
  { value: "spam", label: "Spam" },
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "other", label: "Other" },
];

export function ReportDialog({
  slug,
  variant = "outline",
  className,
}: {
  slug: string;
  variant?: "outline" | "secondary" | "destructive" | "default";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | "">("");
  const [details, setDetails] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = () => {
    if (!reason) {
      toast.error("Please select a reason.");
      return;
    }
    startTransition(async () => {
      const res = await reportLink({ urlCode: slug, reason, details });
      if (res.success) {
        toast.success(
          "Report submitted. Thank you for helping keep Shortn safe.",
        );
        setOpen(false);
        setReason("");
        setDetails("");
      } else if (res.message === "rate-limited") {
        toast.error("You've submitted too many reports. Try again later.");
      } else {
        toast.error("Could not submit report. Please try again.");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} className={className}>
          <Flag className="size-4" />
          Report Link
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report this link</DialogTitle>
          <DialogDescription>
            Let us know why this link looks unsafe. Reports are reviewed and
            abusive links are disabled automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="report-reason">Reason</Label>
            <Select
              value={reason}
              onValueChange={(v) => setReason(v as ReportReason)}
            >
              <SelectTrigger id="report-reason" className="w-full">
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="report-details">Details (optional)</Label>
            <Textarea
              id="report-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={1000}
              placeholder="Add any context that helps our review."
              rows={4}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Submitting…" : "Submit report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
