import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";
import { connectDB } from "@/lib/mongodb";
import { BioPage } from "@/models/link-in-bio/BioPage";
import { setRequestLocale } from "next-intl/server";

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user) {
    redirect({ href: "login", locale });
  }
  await connectDB();
  const bios = await BioPage.find({ userId: session!.user.sub }).lean();
  console.log(bios);
  return (
    <main className="flex flex-col items-center w-full mx-auto md:gap-0 gap-2 bg-accent px-4 sm:pt-14! pt-6! pb-16"></main>
  );
}
