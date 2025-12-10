"use client";

import { use } from "react";
import { Skeleton } from "../ui/skeleton";

import { VerificationAlready } from "./verification-already";
import { VerificationError } from "./verication-error";
import { VerificationSuccess } from "./verification-success";
import { verifyEmail } from "@/app/actions/userActions";

export const VerificationHolder = ({
  email,
  token,
}: {
  email: string;
  token: string;
}) => {
  const { success, message } = use(verifyEmail(email, token));
  const verificationResult =
    !email || !token ? "" : success ? "true" : message || "";

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
