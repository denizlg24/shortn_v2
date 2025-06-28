"use server";
import { signIn } from "@/auth";
import { AuthError } from "next-auth";

export async function authenticate(
    formData: { email: string; password: string }
) {
    try {
        await signIn("credentials", formData);
        return true;
    } catch (error) {
        if (error instanceof AuthError) {
            return error;
        }
        throw error;
    }
}
