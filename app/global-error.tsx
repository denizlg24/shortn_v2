"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { ErrorComponent } from "./_error_component";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return <ErrorComponent errorCode={500} />;
}
