"use client";

import * as React from "react";
import { motion } from "framer-motion";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Mail } from "lucide-react";

export function ChangeRequestSent({ initialEmail }: { initialEmail?: string }) {
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
            Email Change Request Sent
          </h2>
          <p className="text-sm text-muted-foreground text-center">
            We&apos;ve sent a confirmation email to your current email address.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          <Alert>
            <Mail className="h-4 w-4" />
            <AlertTitle>Check Your Inbox</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>
                To confirm this email change request, please open the
                confirmation link we sent to <strong>{initialEmail}</strong>.
              </p>
              <p className="text-xs">
                If you don&apos;t see the email, check your spam or junk folder.
              </p>
            </AlertDescription>
          </Alert>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.4 }}
          className="rounded-lg border bg-card p-4"
        >
          <h3 className="font-medium text-sm mb-2">What happens next?</h3>
          <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
            <li>Check your original email inbox</li>
            <li>Click the confirmation link in the email</li>
            <li>Your email address will be updated</li>
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
          Back to Login
        </Button>
      </motion.div>

      <p className="text-center text-xs text-muted-foreground pt-4">
        For your security, this request will expire in 30 minutes.
      </p>
    </motion.div>
  );
}
