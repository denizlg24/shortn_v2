"use server";

import { connectDB } from "@/lib/mongodb";
import UrlV3 from "@/models/url/UrlV3";
import { createConfirmationToken } from "@/lib/confirmation-token";

/**
 * Issues a confirmation token for the interstitial "Continue" action. The
 * token is only minted for links that exist and are not blocked, so a disabled
 * link can never produce a valid bypass token.
 */
export async function getConfirmationToken(
  slug: string,
): Promise<
  { success: true; token: string } | { success: false; message: string }
> {
  try {
    await connectDB();
    const doc = await UrlV3.findOne({ urlCode: slug })
      .select("disabled safetyStatus")
      .lean();

    if (!doc) {
      return { success: false, message: "not-found" };
    }

    if (
      doc.disabled ||
      doc.safetyStatus === "blocked" ||
      doc.safetyStatus === "malicious"
    ) {
      return { success: false, message: "blocked" };
    }

    const token = await createConfirmationToken(slug);
    return { success: true, token };
  } catch (error) {
    console.error("[getConfirmationToken] error:", error);
    return { success: false, message: "server-error" };
  }
}
