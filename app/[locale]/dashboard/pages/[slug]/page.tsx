import { redirect } from "@/i18n/navigation";
import { connectDB } from "@/lib/mongodb";
import { BioPage } from "@/models/link-in-bio/BioPage";
import { setRequestLocale } from "next-intl/server";

import { notFound } from "next/navigation";
import { ManageLinksPage } from "./manage-links-page";
import { IUrl } from "@/models/url/UrlV3";
import { getServerSession } from "@/lib/session";
import { getUserPlan } from "@/app/actions/polarActions";
import { BASEURL } from "@/lib/utils";

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const session = await getServerSession();
  const user = session?.user;

  if (!user) {
    redirect({ href: "/dashboard/logout", locale: locale });
    return;
  }
  const { plan } = await getUserPlan();
  if (plan != "pro") {
    redirect({ href: "/dashboard/subscription", locale });
  }

  await connectDB();
  const bioPage = await BioPage.findOne({ slug, userId: user.sub })
    .populate({
      path: "links.link",
      model: "UrlV3",
    })
    .lean();

  if (!bioPage) {
    notFound();
  }

  const links = (
    bioPage.links as {
      link: IUrl;
      image?: string;
      title?: string;
      addedAt?: Date;
    }[]
  ).map((link) => ({
    _id: (link.link._id as string).toString(),
    shortUrl: `${BASEURL}/${link.link.urlCode}`,
    title: link.link.title || "",
    createdAt: link.link.date || new Date(),
    addedAt: link.addedAt || new Date(),
    image: link.image,
    customTitle: link.title,
  }));

  return <ManageLinksPage initialLinks={links} slug={slug} />;
}
