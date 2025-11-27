import "../../globals.css";
import { connectDB } from "@/lib/mongodb";
import { BioPage } from "@/models/link-in-bio/BioPage";

export async function generateStaticParams() {
  await connectDB();
  const bios = await BioPage.find({}, { slug: 1 })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  return bios.map((bio) => ({
    slug: bio.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  await connectDB();
  const bioPage = await BioPage.findOne({ slug }).lean();

  if (!bioPage) return {};

  return {
    title: bioPage.title ?? "Shortn landing Page",
    description: bioPage.description ?? `Check out this shortn landing page`,
    openGraph: {
      title: bioPage.title,
      description: bioPage.description,
      url: `https://shortn.at/b/${slug}`,
      images: [bioPage.avatarUrl ?? ""],
    },
    twitter: {
      card: "summary_large_image",
      title: bioPage.title,
      description: bioPage.description,
      images: [bioPage.avatarUrl ?? ""],
    },
  };
}
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`antialiased w-full min-h-screen`}>{children}</body>
    </html>
  );
}
