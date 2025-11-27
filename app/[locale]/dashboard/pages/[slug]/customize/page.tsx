import { redirect } from "@/i18n/navigation";
import { connectDB } from "@/lib/mongodb";
import { BioPage } from "@/models/link-in-bio/BioPage";

import { setRequestLocale } from "next-intl/server";
import { getUser } from "@/app/actions/userActions";
import { notFound } from "next/navigation";
import { CustomizeBioPage } from "./customize-page";
import { IUrl } from "@/models/url/UrlV3";

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
  const bioPage = await BioPage.findOne({ userId: user.sub, slug })
    .populate<IUrl>("links", "UrlV3")
    .lean();
  if (!bioPage) {
    notFound();
  }
  const bioLinks = bioPage.links as {
    link: IUrl;
    image?: string;
    title?: string;
  }[];

  return (
    <main className="flex flex-col items-center w-full mx-auto md:gap-0 gap-2 bg-accent px-4 sm:pt-14! pt-6! pb-16">
      <CustomizeBioPage
        initialBio={{
          userId: bioPage.userId,
          slug: bioPage.slug,
          title: bioPage.title ?? "",
          description: bioPage.description,
          avatarUrl: bioPage.avatarUrl,
          theme: {
            primaryColor: bioPage.theme?.primaryColor,
            background: bioPage.theme?.background,
            textColor: bioPage.theme?.textColor,
            buttonStyle: bioPage.theme?.buttonStyle,
            ...(bioPage.theme?.header
              ? {
                  header: {
                    headerStyle: bioPage.theme?.header?.headerStyle,
                    headerBackgroundImage:
                      bioPage.theme?.header?.headerBackgroundImage,
                    headerBackgroundColor:
                      bioPage.theme?.header?.headerBackgroundColor,
                  },
                }
              : {}),
          },
          links: bioLinks.map((link) => ({
            link: {
              shortUrl: link.link.shortUrl,
              title: link.link.title || "",
            },
            image: link.image,
            title: link.title,
          })),
          createdAt: bioPage.createdAt,
          updatedAt: bioPage.updatedAt,
        }}
      />
    </main>
  );
}
