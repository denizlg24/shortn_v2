"use client";

import { SectionError } from "@/components/shell/section-error";

export default function BioError(props: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <SectionError section="bio" {...props} />;
}
