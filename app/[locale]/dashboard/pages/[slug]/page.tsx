import { redirect } from "@/i18n/navigation";
import { connectDB } from "@/lib/mongodb";
import { BioPage } from "@/models/link-in-bio/BioPage";
import { setRequestLocale } from "next-intl/server";
import { getUser } from "@/app/actions/userActions";
import { notFound } from "next/navigation";
import { ManageLinksPage } from "./manage-links-page";
import { IUrl } from "@/models/url/UrlV3";

export default async function Page({
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
    shortUrl: link.link.shortUrl,
    title: link.link.title || "",
    createdAt: link.link.date || new Date(),
    addedAt: link.addedAt || new Date(),
    image: link.image,
    customTitle: link.title,
  }));

  return <ManageLinksPage initialLinks={links} slug={slug} />;
}
