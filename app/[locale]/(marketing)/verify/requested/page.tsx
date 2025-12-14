import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ChangeRequestSent } from "@/components/marketing/change-request-change";

export default async function EmailSentPage() {
  const cookieStore = await cookies();
  const hasFlowCookie = cookieStore.has("flow_request_change_success");
  const email = cookieStore.get("flow_request_change_email")?.value;

  if (!hasFlowCookie) {
    redirect("/login");
  }

  return (
    <main className="flex flex-col items-center w-full mx-auto md:gap-0 gap-2 mb-16">
      <div className="w-full flex flex-col max-w-lg p-4 gap-6 sm:pt-8">
        <ChangeRequestSent initialEmail={email} />
      </div>
    </main>
  );
}
