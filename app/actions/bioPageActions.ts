"use server";

import { BioPage } from "@/models/link-in-bio/BioPage";
import { getUser } from "./userActions";
import { connectDB } from "@/lib/mongodb";

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

export async function updateBioPage({
  bio,
}: {
  bio: {
    userId: string;
    slug: string;
    title: string;
    description?: string;
    avatarUrl?: string;
    theme?: {
      primaryColor?: string;
      background?: string;
      textColor?: string;
      buttonStyle?: "rounded" | "square" | "pill";
      font?: string;
      header?: {
        headerStyle: "centered" | "left-aligned" | "right-aligned";
        headerBackgroundImage?: string;
        headerBackgroundColor?: string;
      };
    };
    links: {
      link: { shortUrl: string; title: string };
      image?: string;
      title?: string;
    }[];
    socials?: { url: string; platform: string }[];
    socialColor: string | "original";
    createdAt: Date;
    updatedAt: Date;
  };
}) {
  try {
    const session = await getUser();
    if (!session.success || !session.user) {
      return { success: false, message: "no-user" };
    }
    if (session.user.sub !== bio.userId) {
      return { success: false, message: "unauthorized" };
    }
    if (session.user.plan.subscription != "pro") {
      return { success: false, message: "plan-restricted" };
    }
    await connectDB();
    await BioPage.findOneAndUpdate({ userId: bio.userId, slug: bio.slug }, bio);
    return { success: true };
  } catch (error) {
    console.log(error);
    return { success: false, message: "server-error" };
  }
}
