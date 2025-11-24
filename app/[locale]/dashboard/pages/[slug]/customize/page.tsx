import { redirect } from "@/i18n/navigation";
import { connectDB } from "@/lib/mongodb";
import { BioPage } from "@/models/link-in-bio/BioPage";

import { setRequestLocale } from "next-intl/server";
import { getUser } from "@/app/actions/userActions";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const { success, user } = await getUser();

  if (!success || !user) {
    redirect({ href: "/login", locale });
    return;
  }

  if (user.plan.subscription != "pro") {
    redirect({ href: "/dashboard/subscription", locale });
  }

  await connectDB();
  const bioPage = await BioPage.findOne({ userId: user.sub, slug }).lean();
  if (!bioPage) {
    notFound();
  }
  return (
    <main className="flex flex-col items-center w-full mx-auto md:gap-0 gap-2 bg-accent px-4 sm:pt-14! pt-6! pb-16">
      <div className="w-full max-w-7xl mx-auto flex lg:flex-row lg:items-start items-center gap-6 flex-col-reverse">
        <div className="grow w-full flex flex-col gap-6">
          <h1 className="font-black lg:text-3xl md:text-2xl text-xl">
            Customize your page
          </h1>
          <Card className="w-full"></Card>
        </div>

        <div className="hidden lg:flex w-full max-w-[375px] shrink-0 flex-col items-center gap-4">
          <h1 className="font-semibold text-base text-yellow-800 bg-yellow-50 px-3 py-1 rounded border border-yellow-800">
            Live preview
          </h1>
          <iframe
            className="w-full h-[550px] border rounded"
            src={`/b/${bioPage.slug}`}
          >
            Your browser does not support iframes.
          </iframe>
        </div>

        <Collapsible className="lg:hidden w-full">
          <CollapsibleTrigger className="w-full group">
            <div className="flex items-center justify-between p-2! bg-background border rounded-md">
              <div className="font-semibold xs:text-sm text-xs text-yellow-800 bg-yellow-50 px-2 py-0.5 rounded border border-yellow-800">
                Live preview
              </div>
              <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <iframe
              className="max-w-[375px] w-full h-[550px] border rounded mt-2"
              src={`/b/${bioPage.slug}`}
            >
              Your browser does not support iframes.
            </iframe>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </main>
  );
}
