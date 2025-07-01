import { auth } from "@/auth";
import { DashboardHeaderClient } from "./dasboard-header-client";
export const DashboardHeader = async () => {
  const session = await auth();
  return <DashboardHeaderClient user={session?.user} />;
};
