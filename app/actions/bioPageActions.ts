"use server";

import { BioPage } from "@/models/link-in-bio/BioPage";
import { getUser } from "./userActions";

export async function createBioPage({
  title,
  slug,
}: {
  title: string | undefined;
  slug: string;
}) {
  try {
    const { success, user } = await getUser();
    if (!success || !user) {
      return { success: false, message: "no-user" };
    }
    const sub = user.sub;
    const plan = user.plan.subscription;
    if (plan != "pro") {
      return { success: false, message: "plan-restricted" };
    }

    const foundSlug = await BioPage.findOne({ slug });
    if (foundSlug) {
      return { success: false, message: "duplicate" };
    }

    const newPage = await BioPage.create({
      userId: sub,
      title:
        title ||
        `${user.displayName}'s Bio Page ${Math.floor(Math.random() * 1000)}`,
      slug,
    });
    return { success: true, slug: newPage.slug };
  } catch (error) {
    console.log(error);
    return { success: false, message: "server-error" };
  }
}
