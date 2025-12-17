"use server";
import { cookies } from "next/headers";
export async function deleteCookies() {
  const cookieStore = await cookies();
  cookieStore.getAll().map((cookie) => {
    if (
      cookie.name.startsWith("shortn_auth_") ||
      cookie.name.startsWith("better-auth.")
    )
      cookieStore.delete(cookie.name);
  });
}
