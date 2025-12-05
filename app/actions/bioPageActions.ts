"use server";

import { BioPage } from "@/models/link-in-bio/BioPage";
import { getUser } from "./userActions";
import { connectDB } from "@/lib/mongodb";
import { getShortn } from "@/utils/fetching-functions";
import mongoose from "mongoose";
import UrlV3 from "@/models/url/UrlV3";
import { revalidatePath } from "next/cache";
import { deletePicture } from "./deletePicture";

export async function createBioPage({
  title,
  slug,
  urlCode,
}: {
  title: string | undefined;
  slug: string;
  urlCode?: string;
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
    await connectDB();
    const foundSlug = await BioPage.findOne({ slug });
    if (foundSlug) {
      return { success: false, message: "duplicate" };
    }

    const { url } = urlCode ? await getShortn(urlCode) : { url: undefined };

    const newPage = await BioPage.create({
      userId: sub,
      title:
        title ||
        `${user.displayName}'s Bio Page ${Math.floor(Math.random() * 1000)}`,
      slug,
      links: url
        ? [{ link: new mongoose.Types.ObjectId(url._id), title: url.title }]
        : [],
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
      buttonTextColor?: string;
      background?: string;
      textColor?: string;
      buttonStyle?: "rounded" | "square" | "pill";
      font?: string;
      titleFontSize?: string;
      titleFontWeight?: string;
      descriptionFontSize?: string;
      descriptionFontWeight?: string;
      buttonFontSize?: string;
      buttonFontWeight?: string;
      header?: {
        headerStyle: "centered" | "left-aligned" | "right-aligned";
        headerBackgroundImage?: string;
        headerBackgroundColor?: string;
      };
    };
    links?: {
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
    delete bio.links;
    await BioPage.findOneAndUpdate({ userId: bio.userId, slug: bio.slug }, bio);
    revalidatePath(`/b/${bio.slug}`);
    return { success: true };
  } catch (error) {
    console.log(error);
    return { success: false, message: "server-error" };
  }
}

export async function updateBioLink({
  slug,
  linkId,
  title,
  image,
}: {
  slug: string;
  linkId: string;
  title?: string;
  image?: string;
}) {
  try {
    const session = await getUser();
    if (!session.success || !session.user) {
      return { success: false, message: "no-user" };
    }
    if (session.user.plan.subscription != "pro") {
      return { success: false, message: "plan-restricted" };
    }

    await connectDB();

    const updateFields: Record<string, string> = {};
    if (title !== undefined) {
      updateFields["links.$.title"] = title;
    }
    if (image !== undefined) {
      updateFields["links.$.image"] = image;
    }

    const result = await BioPage.updateOne(
      {
        userId: session.user.sub,
        slug,
        "links.link": new mongoose.Types.ObjectId(linkId),
      },
      {
        $set: updateFields,
      },
    );

    if (result.matchedCount === 0) {
      return { success: false, message: "link-not-found" };
    }
    revalidatePath(`/b/${slug}`);
    return { success: true };
  } catch (error) {
    console.log(error);
    return { success: false, message: "server-error" };
  }
}

export async function removeLinkFromBio({
  slug,
  linkId,
}: {
  slug: string;
  linkId: string;
}) {
  try {
    const session = await getUser();
    if (!session.success || !session.user) {
      return { success: false, message: "no-user" };
    }
    if (session.user.plan.subscription != "pro") {
      return { success: false, message: "plan-restricted" };
    }

    await connectDB();

    const result = await BioPage.updateOne(
      {
        userId: session.user.sub,
        slug,
      },
      {
        $pull: {
          links: { link: new mongoose.Types.ObjectId(linkId) },
        },
      },
    );

    if (result.matchedCount === 0) {
      return { success: false, message: "not-found" };
    }
    revalidatePath(`/b/${slug}`);
    return { success: true };
  } catch (error) {
    console.log(error);
    return { success: false, message: "server-error" };
  }
}

export async function reorderBioLinks({
  slug,
  linkIds,
}: {
  slug: string;
  linkIds: string[];
}) {
  try {
    const session = await getUser();
    if (!session.success || !session.user) {
      return { success: false, message: "no-user" };
    }
    if (session.user.plan.subscription != "pro") {
      return { success: false, message: "plan-restricted" };
    }

    await connectDB();

    const bioPage = await BioPage.findOne({
      userId: session.user.sub,
      slug,
    });

    if (!bioPage) {
      return { success: false, message: "not-found" };
    }

    const reorderedLinks = linkIds
      .map((id) => bioPage.links.find((l) => l.link.toString() === id))
      .filter((l) => l !== undefined);

    await BioPage.updateOne(
      {
        userId: session.user.sub,
        slug,
      },
      {
        $set: {
          links: reorderedLinks,
        },
      },
    );
    revalidatePath(`/b/${slug}`);
    return { success: true };
  } catch (error) {
    console.log(error);
    return { success: false, message: "server-error" };
  }
}

export async function addLinkToBioPage({
  slug,
  linkId,
}: {
  slug: string;
  linkId: string;
}) {
  try {
    const session = await getUser();
    if (!session.success || !session.user) {
      return { success: false, message: "no-user" };
    }
    if (session.user.plan.subscription != "pro") {
      return { success: false, message: "plan-restricted" };
    }

    await connectDB();

    const bioPage = await BioPage.findOne({
      userId: session.user.sub,
      slug,
    });

    if (!bioPage) {
      return { success: false, message: "not-found" };
    }

    const linkExists = bioPage.links.some((l) => l.link.toString() === linkId);
    if (linkExists) {
      return { success: false, message: "link-already-added" };
    }

    const link = await UrlV3.findById(linkId);
    if (!link) {
      return { success: false, message: "link-not-found" };
    }

    await BioPage.updateOne(
      {
        userId: session.user.sub,
        slug,
      },
      {
        $push: {
          links: {
            link: new mongoose.Types.ObjectId(linkId),
            title: link.title || "Untitled Link",
            addedAt: new Date(),
          },
        },
      },
    );
    revalidatePath(`/b/${slug}`);
    return { success: true };
  } catch (error) {
    console.log(error);
    return { success: false, message: "server-error" };
  }
}

export async function getUserBioPages() {
  try {
    const session = await getUser();
    if (!session.success || !session.user) {
      return { success: false, message: "no-user", bioPages: [] };
    }
    if (session.user.plan.subscription != "pro") {
      return { success: false, message: "plan-restricted", bioPages: [] };
    }

    await connectDB();

    const bioPages = await BioPage.find({ userId: session.user.sub })
      .select("slug title avatarUrl")
      .lean();

    const serializedPages = bioPages.map((page) => ({
      _id: page._id.toString(),
      slug: page.slug,
      title: page.title,
      avatarUrl: page.avatarUrl,
    }));

    return { success: true, bioPages: serializedPages };
  } catch (error) {
    console.log(error);
    return { success: false, message: "server-error", bioPages: [] };
  }
}

export async function deleteBioPage({ slug }: { slug: string }) {
  try {
    const session = await getUser();
    if (!session.success || !session.user) {
      return { success: false, message: "no-user" };
    }
    if (session.user.plan.subscription != "pro") {
      return { success: false, message: "plan-restricted" };
    }
    await connectDB();
    const deleted = await BioPage.findOneAndDelete({
      userId: session.user.sub,
      slug,
    });
    const imgsToDelete =
      deleted?.links
        .map((l) => l.image)
        .filter((img): img is string => !!img) || [];
    const headerImg = deleted?.theme?.header?.headerBackgroundImage;
    if (headerImg) {
      imgsToDelete.push(headerImg);
    }
    const avatarImg = deleted?.avatarUrl;
    if (avatarImg) {
      imgsToDelete.push(avatarImg);
    }
    for (const imgUrl of imgsToDelete) {
      await deletePicture(imgUrl);
    }
    revalidatePath(`/b/${slug}`);
    return { success: true };
  } catch (error) {
    console.log(error);
    return { success: false, message: "server-error" };
  }
}
