"use server";


import { signOut } from "@/auth";

export const signOutUser = async (redirect?: string) => {
    await signOut({ redirectTo: redirect || "/" });
}