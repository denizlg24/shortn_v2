"use client";

import * as React from "react";
import { motion } from "framer-motion";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Mail } from "lucide-react";
import { useTranslations } from "next-intl";

export function ChangeRequestSent({ initialEmail }: { initialEmail?: string }) {
  const t = useTranslations("verify.requested");
  const tVerify = useTranslations("verify");
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
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

      <div className="space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <h2 className="text-2xl font-semibold text-center mb-2">
            {t("title")}
          </h2>
          <p className="text-sm text-muted-foreground text-center">
            {t("subtitle")}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          <Alert>
            <Mail className="h-4 w-4" />
            <AlertTitle>{t("check-inbox-title")}</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>
                {t("confirm-link-description")} <strong>{initialEmail}</strong>.
              </p>
              <p className="text-xs">{t("check-spam")}</p>
            </AlertDescription>
          </Alert>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.4 }}
          className="rounded-lg border bg-card p-4"
        >
          <h3 className="font-medium text-sm mb-2">{t("what-happens-next")}</h3>
          <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
            <li>{t("step-1")}</li>
            <li>{t("step-2")}</li>
            <li>{t("step-3")}</li>
          </ol>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.5 }}
        className="flex justify-center pt-2"
      >
        <Button
          type="button"
          variant="outline"
          onClick={() => window.location.assign("/login")}
          className="w-full sm:w-auto"
        >
          {tVerify("back-to-login")}
        </Button>
      </motion.div>

      <p className="text-center text-xs text-muted-foreground pt-4">
        {t("security-expire")}
      </p>
    </motion.div>
  );
}
