"use server";

import { signOut } from "@/auth";
import { cookies } from "next/headers";

export const signOutUser = async (redirect?: string) => {
  (await cookies()).delete("login_tracked");
  await signOut({ redirectTo: redirect || "/" });
};
