import { signOut } from "@/auth";
import { Button } from "./button";

export const DashboardHeader = () => {
  return (
    <header className="fixed top-0 p-2 w-full sm:h-14 h-12 border-b shadow bg-background z-90 transition-shadow flex flex-row">
      <Button
        className="ml-auto"
        onClick={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      >
        Log Out
      </Button>
    </header>
  );
};
