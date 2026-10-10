import { authClient } from "@shortn/auth/client";
import { useCallback, useState } from "react";

export function useSignOut() {
  const [pending, setPending] = useState(false);
  const signOut = useCallback(async () => {
    setPending(true);
    try {
      const { error } = await authClient.signOut();
      if (!error) {
        // A full load drops every cached RSC payload of the signed-in session.
        window.location.assign("/login");
        return;
      }
    } catch {
      // Network failure: the session is still valid, so stay put.
    }
    setPending(false);
  }, []);
  return { signOut, pending };
}
