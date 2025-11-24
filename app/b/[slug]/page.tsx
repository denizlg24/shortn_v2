import { connectDB } from "@/lib/mongodb";
import { BioPage } from "@/models/link-in-bio/BioPage";
import { notFound } from "next/navigation";

export default async function Home({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  await connectDB();
  const bioPage = await BioPage.findOne({ slug }).lean();
  if (!bioPage) {
    notFound();
  }
  return <div>{bioPage.title}</div>;
}
