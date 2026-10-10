import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AuthFrame } from "@/components/auth/auth-frame";
import { getSession } from "@/server/auth";

export default async function AuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  if (await getSession()) redirect("/");
  return <AuthFrame>{children}</AuthFrame>;
}
