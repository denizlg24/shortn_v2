"use client";

import { SectionError } from "@/components/shell/section-error";

export default function TagsError(props: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <SectionError section="tags" {...props} />;
}
