import { ReactNode } from "react";
import { getServerSession } from "@/lib/session";
import type { ServerSession } from "@/lib/session";

interface WithSessionProps {
  children: (session: ServerSession | null) => ReactNode;
}

export const WithSession = async ({ children }: WithSessionProps) => {
  const session = await getServerSession();
  return <>{children(session)}</>;
};
