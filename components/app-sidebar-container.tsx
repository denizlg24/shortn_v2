import { auth } from "@/auth";
import { AppSidebar } from "./app-sidebar";

export const AppSideBarContainer = async () => {
  const session = await auth();
  return <AppSidebar user={session?.user} />;
};
