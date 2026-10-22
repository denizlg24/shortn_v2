import { NoticePage } from "@/components/notice-page";

export const metadata = { title: "Signed out" };

export default function SignedOutPage() {
  return (
    <NoticePage
      title="Signed out"
      action={{ href: "/login", label: "Sign in again" }}
    >
      Your admin session has ended. Your app.shortn.at session is unchanged.
    </NoticePage>
  );
}
