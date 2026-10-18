"use client";

import { SectionError } from "@/components/shell/section-error";

export default function CampaignsError(props: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <SectionError section="campaigns" {...props} />;
}
