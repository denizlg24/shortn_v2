"use client";

import { SectionError } from "@/components/shell/section-error";

export default function QrError(props: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <SectionError section="qr" {...props} />;
}
