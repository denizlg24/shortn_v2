import { connectDB } from "@/lib/mongodb";
import { BioPage } from "@/models/link-in-bio/BioPage";
import { IUrl } from "@/models/url/UrlV3";
import { notFound } from "next/navigation";
import { BioPageDisplay } from "../bio-page-display";

export default async function Home({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  await connectDB();
  const bioPage = await BioPage.findOne({ slug })
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
    <BioPageDisplay
      preview={false}
      bio={{
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
  );
}
