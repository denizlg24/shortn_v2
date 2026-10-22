import { NoticePage } from "@/components/notice-page";

export const metadata = { title: "Sign-in failed" };

const reasons: Record<string, string> = {
  expired:
    "The sign-in link expired or was opened in a different browser. Start again from this browser.",
  not_staff: "This account doesn't have admin access, or it's suspended.",
  session:
    "Your admin session ended before the step-up finished. Sign in again.",
};

export default async function AuthErrorPage({
  searchParams,
}: PageProps<"/auth/error">) {
  const { reason } = await searchParams;
  return (
    <NoticePage
      title="Sign-in failed"
      action={{ href: "/login", label: "Try again" }}
    >
      {(typeof reason === "string" && reasons[reason]) || reasons.expired}
    </NoticePage>
  );
}
