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
    <main className="h-full w-full bg-transparent">
      <BioPageDisplay
        preview={false}
        bio={{
          userId: bioPage.userId,
          slug: bioPage.slug,
          title: bioPage.title ?? "",
          description: bioPage.description,
          avatarUrl: bioPage.avatarUrl,
          avatarShape: bioPage.avatarShape,
          theme: {
            primaryColor: bioPage.theme?.primaryColor,
            buttonTextColor: bioPage.theme?.buttonTextColor,
            background: bioPage.theme?.background,
            textColor: bioPage.theme?.textColor,
            buttonStyle: bioPage.theme?.buttonStyle,
            font: bioPage.theme?.font,
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
