"use server";
import { signIn } from "@/auth";
import { AuthError } from "next-auth";


export async function authenticate(
    formData: { email: string; password: string }
) {
    try {
        await signIn("credentials", { ...formData, redirect: false });
        return true;
    } catch (error) {
        if (error instanceof AuthError) {
            return { name: "CredentialsSignin", message: error.message };
        }
        return { name: "ServerError", message: "server-error" };
    }
}

export async function githubAuthenticate() {
    try {
        const url = await signIn("github", { redirect: false });
        return { success: true, url };
    } catch (error) {
        if (error instanceof AuthError) {
            return { name: "CredentialsSignin", message: error.message };
        }
        return { name: "ServerError", message: "server-error" };
    }
}

export async function googleAuthenticate() {
    try {
        const url = await signIn("google", { redirect: false });
        return { success: true, url };
    } catch (error) {
        if (error instanceof AuthError) {
            return { name: "CredentialsSignin", message: error.message };
        }
        return { name: "ServerError", message: "server-error" };
    }
}
