import { ReactNode } from "react";
import { auth } from "@/auth";
import type { Session } from "next-auth"; // or your custom session type

interface WithSessionProps {
  children: (session: Session | null) => ReactNode;
}

export const WithSession = async ({ children }: WithSessionProps) => {
  const session = await auth();
  return <>{children(session)}</>;
};
