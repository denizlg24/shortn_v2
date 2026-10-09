"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/authClient";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { CheckCircle2, XCircle, Mail, AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";

type Status =
  | { kind: "idle" }
  | { kind: "verifying" }
  | { kind: "success" }
  | { kind: "failed"; message: string };

export const EmailChangeRequestConfirm = () => {
  const t = useTranslations("verify.request-change");
  const tVerify = useTranslations("verify");
  const searchParams = useSearchParams();
  const router = useRouter();

  const token = searchParams.get("token");
  const oldEmail = searchParams.get("email");
  const newEmail = searchParams.get("new");

  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [redirectIn, setRedirectIn] = useState<number | null>(null);

  const effectiveStatus: Status =
    !token || !oldEmail || !newEmail
      ? {
          kind: "failed",
          message: t("missing-info"),
        }
      : status;

  const handleConfirm = async () => {
    if (!token) return;

    setStatus({ kind: "verifying" });

    try {
      const { error } = await authClient.verifyEmail({
        query: { token },
      });

      if (error) {
        setStatus({
          kind: "failed",
          message: t("invalid-or-expired"),
        });
        return;
      }

      setStatus({ kind: "success" });
      setRedirectIn(5);
    } catch {
      setStatus({
        kind: "failed",
        message: t("process-error"),
      });
    }
  };

  useEffect(() => {
    if (redirectIn == null) return;
    if (redirectIn <= 0) {
      router.replace("/login");
      return;
    }

    const timer = window.setTimeout(() => {
      setRedirectIn((s) => (s == null ? s : Math.max(0, s - 1)));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [redirectIn, router]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <AnimatePresence mode="wait">
        {effectiveStatus.kind === "idle" && (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <motion.div
              className="flex justify-center"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <div className="rounded-full bg-amber-500/10 p-4">
                <AlertTriangle className="h-8 w-8 text-amber-600" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              <h2 className="text-2xl font-semibold text-center mb-2">
                {t("confirm-title")}
              </h2>
              <p className="text-sm text-muted-foreground text-center">
                {t("confirm-subtitle")}
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.3 }}
            >
              <Alert>
                <Mail className="h-4 w-4" />
                <AlertTitle>{t("email-change-title")}</AlertTitle>
                <AlertDescription className="space-y-2">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">{t("from")}</p>
                    <p className="font-medium">{oldEmail}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">{t("to")}</p>
                    <p className="font-medium">{newEmail}</p>
                  </div>
                </AlertDescription>
              </Alert>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.4 }}
              className="rounded-lg border bg-card p-4"
            >
              <h3 className="font-medium text-sm mb-2">
                {t("what-happens-next")}
              </h3>
              <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                <li>{t("step-1")}</li>
                <li>{t("step-2")}</li>
                <li>{t("step-3")}</li>
              </ol>
            </motion.div>
          </motion.div>
        )}

        {effectiveStatus.kind === "verifying" && (
          <motion.div
            key="verifying"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <motion.div
              className="flex justify-center"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <div className="rounded-full bg-primary/10 p-4">
                <Spinner className="h-8 w-8" />
              </div>
            </motion.div>

            <p className="text-sm text-muted-foreground text-center">
              {t("processing")}
            </p>

            <div className="rounded-lg border bg-card px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner />
                <span>{t("processing-change")}</span>
              </div>
              <div className="mt-2 h-1 w-full overflow-hidden rounded bg-muted">
                <motion.div
                  className="h-full w-1/2 rounded bg-primary"
                  initial={{ x: "-100%" }}
                  animate={{ x: "200%" }}
                  transition={{
                    duration: 1.1,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              </div>
            </div>
          </motion.div>
        )}

        {effectiveStatus.kind === "success" && (
          <motion.div
            key="success"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <motion.div
              className="flex justify-center"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <div className="rounded-full bg-green-500/10 p-4">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              <h2 className="text-2xl font-semibold text-center mb-2">
                {t("success-title")}
              </h2>
              <p className="text-sm text-muted-foreground text-center">
                {t("success-subtitle")}
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.3 }}
            >
              <Alert>
                <Mail className="h-4 w-4" />
                <AlertTitle>{t("verify-new-title")}</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>
                    {t("verify-new-description")} <strong>{newEmail}</strong>.{" "}
                    {t("verify-new-instruction")}
                  </p>
                  <p className="text-xs">{t("check-spam")}</p>
                </AlertDescription>
              </Alert>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.4 }}
            >
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>{t("redirecting-login-title")}</AlertTitle>
                <AlertDescription>
                  {redirectIn != null ? (
                    <>
                      {t("redirecting-login-seconds", { seconds: redirectIn })}
                    </>
                  ) : (
                    t("redirecting-login")
                  )}
                </AlertDescription>
              </Alert>
            </motion.div>

            {redirectIn != null && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.5 }}
                className="h-2 w-full overflow-hidden rounded bg-muted"
              >
                <motion.div
                  className="h-full rounded bg-green-600"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 5, ease: "linear" }}
                />
              </motion.div>
            )}
          </motion.div>
        )}

        {effectiveStatus.kind === "failed" && (
          <motion.div
            key="failed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <motion.div
              className="flex justify-center"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <div className="rounded-full bg-red-500/10 p-4">
                <XCircle className="h-8 w-8 text-red-600" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              <h2 className="text-2xl font-semibold text-center mb-2">
                {t("failed-title")}
              </h2>
              <p className="text-sm text-muted-foreground text-center">
                {t("failed-subtitle")}
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.3 }}
            >
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>{t("error")}</AlertTitle>
                <AlertDescription>{effectiveStatus.message}</AlertDescription>
              </Alert>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.4 }}
              className="rounded-lg border bg-card p-4"
            >
              <h3 className="font-medium text-sm mb-2">
                {t("what-can-you-do")}
              </h3>
              <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
                <li>{t("tip-1")}</li>
                <li>{t("tip-2")}</li>
                <li>{t("tip-3")}</li>
              </ul>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.5 }}
        className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2"
      >
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/login")}
          className="w-full sm:w-auto"
        >
          {tVerify("back-to-login")}
        </Button>

        {effectiveStatus.kind === "idle" && (
          <Button
            type="button"
            onClick={handleConfirm}
            className="w-full sm:w-auto"
          >
            {t("confirm-button")}
          </Button>
        )}
      </motion.div>

      {effectiveStatus.kind === "idle" && (
        <p className="text-center text-xs text-muted-foreground pt-4">
          {t("confirm-note")}
        </p>
      )}
    </motion.div>
  );
};
