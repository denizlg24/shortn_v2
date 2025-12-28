import { redirect } from "@/i18n/navigation";
import { connectDB } from "@/lib/mongodb";
import { BioPage } from "@/models/link-in-bio/BioPage";

import { setRequestLocale } from "next-intl/server";

import { forbidden, notFound } from "next/navigation";
import { CustomizeBioPage } from "./customize-page";
import { IUrl } from "@/models/url/UrlV3";
import { getServerSession } from "@/lib/session";
import { getUserPlan } from "@/app/actions/polarActions";
import { BASEURL } from "@/lib/utils";

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const session = await getServerSession();
  const user = session?.user;

  if (!user) {
    forbidden();
  }
  const { plan } = await getUserPlan();
  if (plan != "pro") {
    redirect({ href: "/dashboard/subscription", locale });
  }

  await connectDB();
  const bioPage = await BioPage.findOne({ slug })
    .populate({
      path: "links.link",
      model: "UrlV3",
    })
    .lean();

  if (!bioPage) {
    notFound();
  }

  const bioLinks = (
    bioPage.links as {
      link: IUrl;
      image?: string;
      title?: string;
    }[]
  ).sort((a, b) => {
    const aDate = a.link.date ? new Date(a.link.date).getTime() : 0;
    const bDate = b.link.date ? new Date(b.link.date).getTime() : 0;
    return bDate - aDate;
  });

  return (
    <main className="flex flex-col items-center w-full mx-auto md:gap-0 gap-2 bg-accent px-4 sm:pt-14! pt-6! pb-16">
      <CustomizeBioPage
        initialBio={{
          userId: bioPage.userId,
          slug: bioPage.slug,
          title: bioPage.title ?? "",
          description: bioPage.description,
          avatarUrl: bioPage.avatarUrl,
          avatarShape: bioPage.avatarShape,
          theme: {
            primaryColor: bioPage.theme?.primaryColor,
            background: bioPage.theme?.background,
            buttonTextColor: bioPage.theme?.buttonTextColor,
            textColor: bioPage.theme?.textColor,
            buttonStyle: bioPage.theme?.buttonStyle,
            font: bioPage.theme?.font,
            titleFontSize: bioPage.theme?.titleFontSize,
            titleFontWeight: bioPage.theme?.titleFontWeight,
            descriptionFontSize: bioPage.theme?.descriptionFontSize,
            descriptionFontWeight: bioPage.theme?.descriptionFontWeight,
            buttonFontSize: bioPage.theme?.buttonFontSize,
            buttonFontWeight: bioPage.theme?.buttonFontWeight,
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
              shortUrl: `${BASEURL}/${link.link.urlCode}`,
              title: link.link.title || "",
            },
            image: link.image,
            title: link.title,
          })),
          socials: bioPage.socials
            ? bioPage.socials.map((social) => ({
                platform: social.platform ?? "",
                url: social.url ?? "",
              }))
            : undefined,
          socialColor: bioPage.socialColor,
          createdAt: bioPage.createdAt,
          updatedAt: bioPage.updatedAt,
        }}
      />
    </main>
  );
}
