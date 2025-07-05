"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "../ui/skeleton";
import { verifyEmail } from "@/app/actions/verifyEmail";
import { VerificationAlready } from "./verification-already";
import { VerificationError } from "./verication-error";
import { VerificationSuccess } from "./verification-success";

export const VerificationHolder = ({
  email,
  token,
}: {
  email: string;
  token: string;
}) => {
  const [verificationResult, setVerificationResult] = useState("");

  useEffect(() => {
    if (!email || !token) {
      setVerificationResult("");
    }

    const verify = async () => {
      const { success, message } = await verifyEmail(email, token);
      console.log(success, message);
      if (success) {
        setVerificationResult("true");
      } else if (message) {
        setVerificationResult(message);
      }
    };

    verify();
  }, []);

  switch (verificationResult) {
    case "true":
      return <VerificationSuccess email={email} />;
    case "token-expired":
      return <VerificationError email={email} />;
    case "user-not-found":
      return <VerificationError email={email} />;
    case "already-verified":
      return <VerificationAlready email={email} />;
    case "error-updating":
      return <VerificationError email={email} />;
    case "server-error":
      return <VerificationError email={email} />;
    default:
      return <Skeleton className="w-full aspect-video" />;
  }
};
