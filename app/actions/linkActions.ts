"use server";

import { getServerSession } from "@/lib/session";
import { connectDB } from "@/lib/mongodb";
import UrlV3, { TUrl } from "@/models/url/UrlV3";
import { nanoid } from "nanoid";
import { UAParser } from "ua-parser-js";
import { isbot } from "isbot";
import { Geo } from "@vercel/functions";
import { BASEURL, escapeRegex } from "@/lib/utils";
import QRCodeV2 from "@/models/url/QRCodeV2";
import { ITag } from "@/models/url/Tag";
import { fetchApi } from "@/lib/utils";
import Clicks from "@/models/url/Click";
import { parse } from "json2csv";
import { Campaigns, ICampaign } from "@/models/url/Campaigns";
import { getUserPlan } from "@/app/actions/polarActions";
import { format } from "date-fns";
import bcrypt from "bcryptjs";
import {
  ingestUsageEvent,
  METER_EVENTS,
  canPerformAction,
} from "@/lib/polar-usage";
import { FlattenMaps } from "mongoose";

interface CreateUrlInput {
  longUrl: string;
  title?: string;
  tags?: string[];
  customCode?: string;
  qrCodeId?: string;
  password?: string;
  passwordHint?: string;
}

async function fetchPageTitle(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { method: "GET" });
    const html = await res.text();
    const match = html.match(/<title>(.*?)<\/title>/i);
    return match ? match[1].trim() : null;
  } catch {
    return null;
  }
}

function formatFallbackDate(): string {
  const now = new Date();
  return now.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export async function createShortn({
  longUrl,
  title,
  tags = [],
  customCode,
  qrCodeId,
  password,
  passwordHint,
}: CreateUrlInput) {
  try {
    const session = await getServerSession();
    const user = session?.user;
    if (!user) {
      return {
        success: false,
        message: "no-user",
      };
    }
    const sub = user?.sub;
    const { plan } = await getUserPlan();

    if (password && plan !== "pro") {
      return {
        success: false,
        message: "password-pro-only",
      };
    }

    await connectDB();
    const urlCode = customCode || nanoid(6);

    if (customCode) {
      const existing = await UrlV3.findOne({ urlCode: customCode });
      if (existing) {
        return {
          success: false,
          message: "duplicate",
          existingUrl: customCode,
        };
      }
    }

    let resolvedTitle = title?.trim();

    if (!resolvedTitle) {
      resolvedTitle = (await fetchPageTitle(longUrl)) || "";
    }

    if (!resolvedTitle) {
      try {
        const url = new URL(longUrl);
        resolvedTitle = `${url.hostname} - untitled`;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (e) {
        resolvedTitle = `Shortn created on ${formatFallbackDate()}`;
      }
    }

    if (plan !== "pro") {
      const { allowed } = await canPerformAction(
        user.id,
        METER_EVENTS.LINK_CREATED,
        plan,
      );
      if (!allowed) {
        return {
          success: false,
          message: "plan-limit",
        };
      }

      if (customCode) {
        return {
          success: false,
          message: "custom-restricted",
        };
      }
    }

    const finalTags: ITag[] = [];

    if (tags && tags.length > 0) {
      const tagResults = await Promise.all(
        tags.map((t) => fetchApi<{ tag: ITag }>(`tags/${t}`)),
      );
      tagResults.forEach((tag) => {
        if (tag.success) {
          finalTags.push(tag.tag);
        }
      });
    }

    let passwordHash: string | undefined = undefined;
    if (password) {
      passwordHash = await bcrypt.hash(password, 10);
    }

    const newUrl = await UrlV3.create({
      sub,
      urlCode,
      customCode: customCode ? true : false,
      longUrl,
      title: resolvedTitle,
      tags: finalTags,
      qrCodeId,
      passwordProtected: !!password,
      passwordHash,
      passwordHint: passwordHint || undefined,
    });

    await ingestUsageEvent({
      customerId: user.id,
      eventName: METER_EVENTS.LINK_CREATED,
      metadata: {
        urlCode,
        plan,
      },
    });

    return {
      success: true,
      data: {
        shortUrl: newUrl.urlCode,
        longUrl: newUrl.longUrl,
        title: newUrl.title,
        passwordProtected: !!password,
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    return {
      success: false,
      message: "server-error",
    };
  }
}

export const getShortn = async (urlCode: string) => {
  try {
    const session = await getServerSession();
    const user = session?.user;

    if (!user) {
      return {
        success: false,
        message: "no-user",
      };
    }
    const sub = user?.sub;
    await connectDB();
    const url = await UrlV3.findOne({ sub, urlCode }).lean();
    if (!url) {
      return { success: false, url: undefined };
    }
    const filtered = {
      ...url,
      _id: url._id.toString(),
      tags: url.tags?.map((tag) => ({ ...tag, _id: tag._id.toString() })),
      utmLinks: url.utmLinks?.map((l) => ({
        ...l,
        _id: l._id?.toString() ?? "",
        ...(l.campaign?.title
          ? {
              campaign: {
                _id: l.campaign._id.toString(),
                title: l.campaign.title,
              },
            }
          : {}),
      })),
    };
    return { success: true, url: filtered };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    return { success: false, url: undefined };
  }
};

export const attachQRToShortn = async (urlCode: string, qrCodeId: string) => {
  try {
    const session = await getServerSession();
    const user = session?.user;

    if (!user) {
      return {
        success: false,
        message: "no-user",
      };
    }
    const sub = user?.sub;
    await connectDB();
    const updated = await UrlV3.findOneAndUpdate(
      { sub, urlCode },
      { qrCodeId },
    );
    if (!updated) {
      return { success: false, message: "error-updating" };
    }
    return { success: true };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    return { success: false, message: "server-error" };
  }
};

export const deleteShortn = async (urlCode: string) => {
  try {
    const session = await getServerSession();
    const user = session?.user;

    if (!user) {
      return {
        success: false,
        message: "no-user",
      };
    }
    const sub = user?.sub;
    const foundURL = await UrlV3.findOneAndDelete({ urlCode, sub });
    await Clicks.deleteMany({ urlCode, type: "click" });
    if (!foundURL) {
      return { success: true, deleted: urlCode };
    }
    if (foundURL.qrCodeId) {
      await QRCodeV2.findOneAndUpdate(
        { sub, qrCodeId: foundURL.qrCodeId },
        { attachedUrl: "" },
      );
    }
    if (foundURL.utmLinks) {
      const campaigns = foundURL.utmLinks
        .filter((section) => section.campaign != undefined)
        .map((section) => section.campaign?._id);

      if (campaigns.length > 0) {
        const updateResults = await Promise.all(
          campaigns.map((id) =>
            Campaigns.findOneAndUpdate(
              { _id: id },
              { $pull: { links: foundURL._id } },
              { new: true },
            ),
          ),
        );

        const campaignsToDelete = updateResults
          .filter((campaign) => campaign && campaign.links.length === 0)
          .map((campaign) => campaign!._id);

        if (campaignsToDelete.length > 0) {
          await Campaigns.deleteMany({ _id: { $in: campaignsToDelete } });
        }
      }
    }
    return { success: true, deleted: urlCode };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    return { success: false, message: "server-error" };
  }
};

export const updateShortnData = async ({
  urlCode,
  title,
  tags,
  custom_code,
  applyToQRCode,
  longUrl,
  password,
  passwordHint,
  removePassword,
}: {
  urlCode: string;
  title: string;
  tags: ITag[];
  custom_code?: string;
  applyToQRCode: boolean;
  longUrl: string;
  password?: string;
  passwordHint?: string;
  removePassword?: boolean;
}) => {
  try {
    const session = await getServerSession();
    const user = session?.user;

    if (!user) {
      return {
        success: false,
        message: "no-user",
      };
    }
    const sub = user?.sub;
    const { plan } = await getUserPlan();

    if ((password || passwordHint) && plan !== "pro") {
      return {
        success: false,
        message: "password-pro-only",
      };
    }

    await connectDB();
    if (custom_code && urlCode != custom_code) {
      const existing = await UrlV3.findOne({ urlCode: custom_code });
      if (existing) {
        return {
          success: false,
          message: "duplicate",
          existingUrl: custom_code,
        };
      }
    }

    if (custom_code && plan != "pro") {
      return { success: false, message: "custom-restricted" };
    }
    const foundUrl = await UrlV3.findOne({ sub, urlCode });
    if (!foundUrl) {
      return { success: false, message: "url-not-found" };
    }

    if (longUrl !== foundUrl.longUrl && plan !== "pro") {
      if (plan === "plus") {
        const { allowed } = await canPerformAction(
          user.id,
          METER_EVENTS.LINK_REDIRECT,
          plan,
        );
        if (!allowed) {
          return { success: false, message: "redirect-plan-limit" };
        }
      } else {
        return { success: false, message: "redirect-plan-limit" };
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateQuery: Record<string, any> = {};
    updateQuery.title = title;
    updateQuery.tags = tags;
    updateQuery.longUrl = longUrl;

    if (removePassword) {
      updateQuery.passwordProtected = false;
      updateQuery.passwordHash = undefined;
      updateQuery.passwordHint = undefined;
    } else if (password) {
      updateQuery.passwordProtected = true;
      updateQuery.passwordHash = await bcrypt.hash(password, 10);
      updateQuery.passwordHint = passwordHint || undefined;
    } else if (passwordHint !== undefined) {
      if (foundUrl.passwordProtected) {
        updateQuery.passwordHint = passwordHint || undefined;
      }
    }

    let updateCode: false | string = false;
    if (custom_code) {
      updateQuery.urlCode = custom_code;
      updateQuery.custom_code = true;
      updateCode = custom_code;
    }
    const url = await UrlV3.findOneAndUpdate({ sub, urlCode }, updateQuery, {
      new: true,
    });

    if (url && longUrl !== foundUrl.longUrl) {
      await ingestUsageEvent({
        customerId: user.id,
        eventName: METER_EVENTS.LINK_REDIRECT,
        metadata: {
          urlCode,
          plan,
        },
      });
    }

    if (updateCode) {
      await Clicks.updateMany(
        { type: "click", urlCode },
        { urlCode: custom_code },
      );
    }
    if (applyToQRCode && url?.qrCodeId) {
      const qrCodeId = url.qrCodeId;
      const updatedQR = await QRCodeV2.findOneAndUpdate(
        { sub, qrCodeId },
        { title, tags, longUrl },
      );
      const qrUrl = updatedQR?.urlId;
      if (updateCode && qrUrl) {
        await UrlV3.findOneAndUpdate(
          {
            sub,
            urlCode: qrUrl,
            isQrCode: true,
          },
          { longUrl },
        );
      }
      if (updatedQR) {
        return { success: true, urlCode: url.urlCode };
      }
      return { success: false };
    }

    if (url) return { success: true, urlCode: url.urlCode };
    return { success: false };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    return { success: false };
  }
};

/**
 * Sanitizes click data to prevent oversized payloads and injection attacks
 */
function sanitizeClickData(data: {
  userAgent?: string;
  referrer?: string;
  language?: string;
  timezone?: string;
  ip?: string;
  query?: Record<string, string>;
}) {
  return {
    userAgent: (data.userAgent || "").slice(0, 2000),
    referrer: (data.referrer || "").slice(0, 4000),
    language: (data.language || "").slice(0, 100),
    timezone: (data.timezone || "").slice(0, 100),
    ip: (data.ip || "").slice(0, 45),
    query: Object.fromEntries(
      Object.entries(data.query || {})
        .slice(0, 50)
        .map(([k, v]) => [k.slice(0, 100), String(v).slice(0, 500)]),
    ),
  };
}

export async function recordClickFromMiddleware(clickData: {
  slug: string;
  ip?: string;
  userAgent?: string;
  referrer?: string;
  language?: string;
  timezone?: string;
  geo?: Geo;
  query?: Record<string, string>;
}) {
  try {
    const { slug, geo } = clickData;

    const sanitized = sanitizeClickData({
      userAgent: clickData.userAgent,
      referrer: clickData.referrer,
      language: clickData.language,
      timezone: clickData.timezone,
      ip: clickData.ip,
      query: clickData.query,
    });

    const { ip, userAgent, referrer, language, query, timezone } = sanitized;

    if (isbot(userAgent)) return { ignored: true };

    await connectDB();

    const urlDoc = await UrlV3.findOne({ urlCode: slug });
    if (!urlDoc) return { notFound: true };

    const ua = new UAParser(userAgent).getResult();

    if (urlDoc.qrCodeId && urlDoc.isQrCode) {
      const qrCodeDoc = await QRCodeV2.findOne({ urlId: slug });
      if (!qrCodeDoc) {
        return { notFound: true };
      }
      await qrCodeDoc.recordClick();
      await Clicks.create({
        urlCode: qrCodeDoc.qrCodeId,
        type: "scan",
        sub: qrCodeDoc.sub,
        ip,
        country: geo?.country,
        region: geo?.countryRegion,
        city: geo?.city,
        timezone,
        language,
        referrer,
        pathname: `/${slug}`,
        queryParams: query,
        userAgent,
        browser: ua.browser.name,
        os: ua.os.name,
        deviceType: ua.device.type || "desktop",
      });
      return { success: true };
    }

    await urlDoc.recordClick();
    await Clicks.create({
      urlCode: urlDoc.urlCode,
      sub: urlDoc.sub,
      type: "click",
      ip,
      country: geo?.country,
      region: geo?.countryRegion,
      city: geo?.city,
      timezone,
      language,
      referrer,
      pathname: `/${slug}`,
      queryParams: query,
      userAgent,
      browser: ua.browser.name,
      os: ua.os.name,
      deviceType: ua.device.type || "desktop",
    });

    return { success: true };
  } catch (error) {
    console.log(error);
    return { success: false };
  }
}

export async function generateCSV({
  code,
  type,
}: {
  code: string;
  type: "click" | "scan";
}) {
  try {
    const session = await getServerSession();
    const user = session?.user;

    if (!user) {
      return { success: false, url: "" };
    }

    await connectDB();
    const clicks = await Clicks.find({ type, urlCode: code })
      .select("-_id -__v -sub -urlCode -type -ip")
      .lean();
    if (!clicks) {
      return { success: false, url: "" };
    }
    const mappedClicks: Record<string, string>[] = clicks.map((click) => {
      return {
        Country: click.country || "",
        Region: click.region || "",
        City: click.city || "",
        Timezone: click.timezone || "",
        Language: click.language || "",
        Browser: click.browser || "",
        OS: click.os || "",
        "Device Type": click.deviceType || "",
        Referrer: click.referrer || "",
        Pathname: click.pathname?.split("?")[1] || "",
        Date: format(click.timestamp, "yyyy-MM-dd HH:mm:ss"),
      };
    });
    const csv = parse(mappedClicks);

    const base64 = Buffer.from(csv).toString("base64");

    return { success: true, url: `data:text/csv;base64,${base64}` };
  } catch (error) {
    console.log(error);
    return { success: false, url: "" };
  }
}

export async function generateCSVFromClicks({ clicks }: { clicks: unknown[] }) {
  try {
    const session = await getServerSession();
    const user = session?.user;

    if (!user) {
      return { success: false, url: "" };
    }

    const csv = parse(clicks);

    const base64 = Buffer.from(csv).toString("base64");

    return { success: true, url: `data:text/csv;base64,${base64}` };
  } catch (error) {
    console.log(error);
    return { success: false, url: "" };
  }
}

export async function updateUTM({
  urlCode,
  utm,
}: {
  urlCode: string;
  utm: {
    source?: string;
    medium?: string;
    campaign?: {
      title: string;
    };
    term?: string;
    content?: string;
  }[];
}) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return { success: false, message: "no-user" };
    }
    const sub = session.user.sub;
    const { plan } = await getUserPlan();
    if (plan != "pro") {
      return { success: false, message: "plan-restricted" };
    }
    const foundUrl = await UrlV3.findOne({ sub, urlCode });
    if (!foundUrl) {
      return { success: false, message: "url-not-found" };
    }

    const currentUtm = foundUrl.utmLinks;

    if ((currentUtm ?? []).length > utm.length) {
      const removed = (currentUtm ?? []).filter(
        (curr) =>
          curr.campaign?._id &&
          !utm.some((ut) => curr.campaign?.title === ut.campaign?.title),
      );

      if (removed.length > 0) {
        const updateResults = await Promise.all(
          removed.map((element) =>
            Campaigns.findOneAndUpdate(
              { _id: element.campaign?._id },
              { $pull: { links: foundUrl._id } },
              { new: true },
            ),
          ),
        );

        const campaignsToDelete = updateResults
          .filter((campaign) => campaign && campaign.links.length === 0)
          .map((campaign) => campaign!._id);

        if (campaignsToDelete.length > 0) {
          await Campaigns.deleteMany({ _id: { $in: campaignsToDelete } });
        }
      }
    }

    const campaignTitles = Array.from(
      new Set(
        utm
          .filter((u) => u.campaign?.title?.trim())
          .map((u) => u.campaign!.title.trim()),
      ),
    );

    const existingCampaigns =
      campaignTitles.length > 0
        ? await Campaigns.find({
            sub,
            title: { $in: campaignTitles },
          }).lean()
        : [];

    const campaignMap = new Map(existingCampaigns.map((c) => [c.title, c]));

    const campaignsToCreate = campaignTitles
      .filter((title) => !campaignMap.has(title))
      .map((title) => ({
        title,
        sub,
        links: [foundUrl._id],
      }));

    if (campaignsToCreate.length > 0) {
      const newCampaigns = await Campaigns.insertMany(campaignsToCreate);
      newCampaigns.forEach((c) => {
        campaignMap.set(
          c.title,
          c as FlattenMaps<ICampaign> &
            Required<{
              _id: FlattenMaps<unknown>;
            }> & {
              __v: number;
            },
        );
      });
    }

    const existingCampaignIds = existingCampaigns.map((c) => c._id);
    if (existingCampaignIds.length > 0) {
      await Campaigns.updateMany(
        { _id: { $in: existingCampaignIds } },
        { $addToSet: { links: foundUrl._id } },
      );
    }

    const finalUtm = utm.map((utmSection) => {
      if (utmSection.campaign?.title?.trim()) {
        const campaign = campaignMap.get(utmSection.campaign.title.trim());
        if (campaign) {
          return {
            source: utmSection.source,
            medium: utmSection.medium,
            campaign: {
              _id: (campaign._id as string).toString(),
              title: utmSection.campaign.title.trim(),
            },
            term: utmSection.term,
            content: utmSection.content,
          };
        }
      }
      return {
        source: utmSection.source,
        medium: utmSection.medium,
        campaign: { title: "" },
        term: utmSection.term,
        content: utmSection.content,
      };
    });

    const newUrl = await UrlV3.findOneAndUpdate(
      { sub, urlCode },
      { utmLinks: finalUtm },
      { new: true },
    ).lean();

    if (!newUrl) {
      return { success: false, message: "url-not-found" };
    }

    return {
      success: true,
      newUrl: {
        ...newUrl,
        _id: newUrl._id.toString(),
        tags: (newUrl.tags || []).map((tag) => ({
          _id: tag._id.toString(),
          id: tag.id,
          tagName: tag.tagName,
          sub: tag.sub,
        })),
        utmLinks: finalUtm.map((utmSection) => ({
          ...utmSection,
          ...(utmSection.campaign?.title
            ? {
                campaign: {
                  title: utmSection.campaign.title,
                  _id: (utmSection.campaign._id as string).toString(),
                },
              }
            : {}),
        })),
      } as TUrl,
    };
  } catch (error) {
    console.log(error);
    return { success: false, message: "server-error" };
  }
}

export async function deleteCampaign({
  campaignTitle,
}: {
  campaignTitle: string;
}) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return { success: false, message: "no-user" };
    }
    const { plan } = await getUserPlan();
    if (plan != "pro") {
      return { success: false, message: "no-user" };
    }
    const sub = session.user.sub;
    const deletedCampaign = await Campaigns.findOneAndDelete({
      sub,
      title: campaignTitle,
    });
    if (!deletedCampaign) {
      return { success: true };
    }

    if (deletedCampaign.links.length > 0) {
      await UrlV3.updateMany(
        { sub, _id: { $in: deletedCampaign.links } },
        {
          $pull: {
            utmLinks: {
              "campaign.title": campaignTitle,
            },
          },
        },
      );
    }
    return { success: true };
  } catch (error) {
    console.log(error);
    return { success: false, message: "server-error" };
  }
}

export async function createCampaign({ title }: { title: string }) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return { success: false, message: "no-user" };
    }
    const { plan } = await getUserPlan();
    if (plan != "pro") {
      return { success: false, message: "plan-restricted" };
    }
    const sub = session.user.sub;
    await connectDB();

    const existingCampaign = await Campaigns.findOne({ sub, title });
    if (existingCampaign) {
      return { success: false, message: "duplicate" };
    }

    const newCampaign = await Campaigns.create({
      title,
      sub,
      links: [],
    });

    return {
      success: true,
      campaign: {
        _id: (newCampaign._id as string).toString(),
        title: newCampaign.title,
        links: [],
      },
    };
  } catch (error) {
    console.log(error);
    return { success: false, message: "server-error" };
  }
}

export async function getUserCampaigns() {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return { success: false, message: "no-user", campaigns: [] };
    }
    const { plan } = await getUserPlan();
    if (plan != "pro") {
      return { success: false, message: "plan-restricted", campaigns: [] };
    }
    const sub = session.user.sub;
    await connectDB();

    const campaigns = await Campaigns.find({ sub }).lean();

    return {
      success: true,
      campaigns: campaigns.map((c) => ({
        _id: c._id.toString(),
        title: c.title,
        linksCount: c.links.length,
        description: c.description,
        utmDefaults: c.utmDefaults
          ? {
              sources: c.utmDefaults.sources || [],
              mediums: c.utmDefaults.mediums || [],
              terms: c.utmDefaults.terms || [],
              contents: c.utmDefaults.contents || [],
            }
          : undefined,
      })),
    };
  } catch (error) {
    console.log(error);
    return { success: false, message: "server-error", campaigns: [] };
  }
}

export async function searchUserLinks({
  query,
  excludeCampaign,
  limit = 10,
}: {
  query?: string;
  excludeCampaign?: string;
  limit?: number;
}) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return { success: false, message: "no-user", links: [] };
    }
    const sub = session.user.sub;
    await connectDB();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = { sub, isQrCode: false };

    if (query && query.trim()) {
      const escapedQuery = escapeRegex(query.trim());
      filter.$or = [
        { title: { $regex: escapedQuery, $options: "i" } },
        { urlCode: { $regex: escapedQuery, $options: "i" } },
        { longUrl: { $regex: escapedQuery, $options: "i" } },
      ];
    }

    if (excludeCampaign) {
      filter["utmLinks.campaign.title"] = { $ne: excludeCampaign };
    }

    const links = await UrlV3.find(filter)
      .sort({ date: -1 })
      .limit(limit)
      .lean();

    return {
      success: true,
      links: links.map((link) => ({
        _id: link._id.toString(),
        urlCode: link.urlCode,
        title: link.title,
        shortUrl: `${BASEURL}/${link.urlCode}`,
        longUrl: link.longUrl,
      })),
    };
  } catch (error) {
    console.log(error);
    return { success: false, message: "server-error", links: [] };
  }
}

export async function addLinkToCampaign({
  urlCode,
  campaignTitle,
}: {
  urlCode: string;
  campaignTitle: string;
}) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return { success: false, message: "no-user" };
    }
    const { plan } = await getUserPlan();
    if (plan != "pro") {
      return { success: false, message: "plan-restricted" };
    }
    const sub = session.user.sub;
    await connectDB();

    const foundUrl = await UrlV3.findOne({ sub, urlCode });
    if (!foundUrl) {
      return { success: false, message: "url-not-found" };
    }

    const alreadyInCampaign = foundUrl.utmLinks?.some(
      (utm) => utm.campaign?.title === campaignTitle,
    );
    if (alreadyInCampaign) {
      return { success: false, message: "already-in-campaign" };
    }

    let campaign = await Campaigns.findOne({ sub, title: campaignTitle });
    if (!campaign) {
      campaign = await Campaigns.create({
        title: campaignTitle,
        sub,
        links: [],
      });
    }

    const newUtmEntry = {
      campaign: {
        _id: campaign._id,
        title: campaignTitle,
      },
    };

    await UrlV3.findOneAndUpdate(
      { sub, urlCode },
      { $push: { utmLinks: newUtmEntry } },
    );

    await Campaigns.findOneAndUpdate(
      { _id: campaign._id },
      { $addToSet: { links: foundUrl._id } },
    );

    return { success: true };
  } catch (error) {
    console.log(error);
    return { success: false, message: "server-error" };
  }
}

export async function updateCampaignDefaults({
  campaignId,
  utmDefaults,
  description,
}: {
  campaignId: string;
  utmDefaults?: {
    sources: string[];
    mediums: string[];
    terms: string[];
    contents: string[];
  };
  description?: string;
}) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return { success: false, message: "no-user" };
    }
    const { plan } = await getUserPlan();
    if (plan !== "pro" && plan !== "plus") {
      return { success: false, message: "plan-restricted" };
    }
    const sub = session.user.sub;
    await connectDB();

    const campaign = await Campaigns.findOne({ sub, _id: campaignId });
    if (!campaign) {
      return { success: false, message: "campaign-not-found" };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateQuery: Record<string, any> = {};
    if (utmDefaults !== undefined) {
      updateQuery.utmDefaults = {
        sources: utmDefaults.sources.map((s) => s.toLowerCase().trim()),
        mediums: utmDefaults.mediums.map((m) => m.toLowerCase().trim()),
        terms: utmDefaults.terms.map((t) => t.toLowerCase().trim()),
        contents: utmDefaults.contents.map((c) => c.toLowerCase().trim()),
      };
    }
    if (description !== undefined) {
      updateQuery.description = description.trim();
    }

    const updatedCampaign = await Campaigns.findOneAndUpdate(
      { sub, _id: campaignId },
      updateQuery,
      { new: true },
    ).lean();

    return {
      success: true,
      campaign: {
        _id: updatedCampaign?._id.toString(),
        title: updatedCampaign?.title,
        description: updatedCampaign?.description,
        utmDefaults: updatedCampaign?.utmDefaults,
        linksCount: updatedCampaign?.links.length,
      },
    };
  } catch (error) {
    console.log(error);
    return { success: false, message: "server-error" };
  }
}

export async function getCampaignWithDefaults({
  campaignId,
}: {
  campaignId: string;
}) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return { success: false, message: "no-user" };
    }
    const { plan } = await getUserPlan();
    if (plan !== "pro" && plan !== "plus") {
      return { success: false, message: "plan-restricted" };
    }
    const sub = session.user.sub;
    await connectDB();

    const campaign = await Campaigns.findOne({ sub, _id: campaignId }).lean();
    if (!campaign) {
      return { success: false, message: "campaign-not-found" };
    }

    return {
      success: true,
      campaign: {
        _id: campaign._id.toString(),
        title: campaign.title,
        description: campaign.description,
        utmDefaults: campaign.utmDefaults
          ? {
              sources: campaign.utmDefaults.sources || [],
              mediums: campaign.utmDefaults.mediums || [],
              terms: campaign.utmDefaults.terms || [],
              contents: campaign.utmDefaults.contents || [],
            }
          : undefined,
        linksCount: campaign.links.length,
      },
    };
  } catch (error) {
    console.log(error);
    return { success: false, message: "server-error" };
  }
}

export async function getCampaignByTitle({ title }: { title: string }) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return { success: false, message: "no-user" };
    }
    const { plan } = await getUserPlan();
    if (plan !== "pro" && plan !== "plus") {
      return { success: false, message: "plan-restricted" };
    }
    const sub = session.user.sub;
    await connectDB();

    const campaign = await Campaigns.findOne({ sub, title }).lean();
    if (!campaign) {
      return { success: false, message: "campaign-not-found" };
    }

    return {
      success: true,
      campaign: {
        _id: campaign._id.toString(),
        title: campaign.title,
        description: campaign.description,
        utmDefaults: campaign.utmDefaults
          ? {
              sources: campaign.utmDefaults.sources || [],
              mediums: campaign.utmDefaults.mediums || [],
              terms: campaign.utmDefaults.terms || [],
              contents: campaign.utmDefaults.contents || [],
            }
          : undefined,
        linksCount: campaign.links.length,
      },
    };
  } catch (error) {
    console.log(error);
    return { success: false, message: "server-error" };
  }
}

export interface CampaignStats {
  totalClicks: number;
  uniqueLinks: number;
  topPerformingLinks: Array<{
    urlCode: string;
    title: string;
    clicks: number;
  }>;
  utmBreakdown: {
    sources: Array<{ name: string; clicks: number }>;
    mediums: Array<{ name: string; clicks: number }>;
    terms: Array<{ name: string; clicks: number }>;
    contents: Array<{ name: string; clicks: number }>;
  };
  geographic: Array<{ country: string; clicks: number }>;
  devices: Array<{ device: string; clicks: number }>;
  browsers: Array<{ browser: string; clicks: number }>;
  timeline: Array<{ date: string; clicks: number }>;
}

export async function getCampaignStats({
  campaignId,
  startDate,
  endDate,
}: {
  campaignId: string;
  startDate?: Date;
  endDate?: Date;
}): Promise<{ success: boolean; message?: string; stats?: CampaignStats }> {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return { success: false, message: "no-user" };
    }
    const { plan } = await getUserPlan();
    if (plan !== "pro" && plan !== "plus") {
      return { success: false, message: "plan-restricted" };
    }
    const sub = session.user.sub;
    await connectDB();

    const campaign = await Campaigns.findOne({ sub, _id: campaignId })
      .populate("links")
      .lean();
    if (!campaign) {
      return { success: false, message: "campaign-not-found" };
    }

    const links = campaign.links as unknown as Array<{
      urlCode: string;
      title: string;
      _id: string;
    }>;
    const urlCodes = links.map((link) => link.urlCode);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const matchQuery: Record<string, any> = {
      urlCode: { $in: urlCodes },
      "queryParams.utm_campaign": campaign.title,
    };

    if (startDate || endDate) {
      matchQuery.timestamp = {};
      if (startDate) matchQuery.timestamp.$gte = startDate;
      if (endDate) matchQuery.timestamp.$lte = endDate;
    }

    const clicks = await Clicks.find(matchQuery).lean();

    const totalClicks = clicks.length;
    const linkClicksMap = new Map<string, number>();
    clicks.forEach((click) => {
      const count = linkClicksMap.get(click.urlCode) || 0;
      linkClicksMap.set(click.urlCode, count + 1);
    });

    const topPerformingLinks = links
      .map((link) => ({
        urlCode: link.urlCode,
        title: link.title || link.urlCode,
        clicks: linkClicksMap.get(link.urlCode) || 0,
      }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 10);

    const sourceMap = new Map<string, number>();
    const mediumMap = new Map<string, number>();
    const termMap = new Map<string, number>();
    const contentMap = new Map<string, number>();
    const countryMap = new Map<string, number>();
    const deviceMap = new Map<string, number>();
    const browserMap = new Map<string, number>();
    const dateMap = new Map<string, number>();

    clicks.forEach((click) => {
      const source = click.queryParams?.utm_source;
      const medium = click.queryParams?.utm_medium;
      const term = click.queryParams?.utm_term;
      const content = click.queryParams?.utm_content;

      if (source) sourceMap.set(source, (sourceMap.get(source) || 0) + 1);
      if (medium) mediumMap.set(medium, (mediumMap.get(medium) || 0) + 1);
      if (term) termMap.set(term, (termMap.get(term) || 0) + 1);
      if (content) contentMap.set(content, (contentMap.get(content) || 0) + 1);

      const country = click.country || "Unknown";
      countryMap.set(country, (countryMap.get(country) || 0) + 1);

      const device = click.deviceType || "unknown";
      const browser = click.browser || "unknown";
      deviceMap.set(device, (deviceMap.get(device) || 0) + 1);
      browserMap.set(browser, (browserMap.get(browser) || 0) + 1);

      const dateKey = format(click.timestamp, "yyyy-MM-dd");
      dateMap.set(dateKey, (dateMap.get(dateKey) || 0) + 1);
    });

    const mapToArray = (map: Map<string, number>) =>
      Array.from(map.entries())
        .map(([name, clicks]) => ({ name, clicks }))
        .sort((a, b) => b.clicks - a.clicks);

    const stats: CampaignStats = {
      totalClicks,
      uniqueLinks: links.length,
      topPerformingLinks,
      utmBreakdown: {
        sources: mapToArray(sourceMap),
        mediums: mapToArray(mediumMap),
        terms: mapToArray(termMap),
        contents: mapToArray(contentMap),
      },
      geographic: mapToArray(countryMap).map((item) => ({
        country: item.name,
        clicks: item.clicks,
      })),
      devices: mapToArray(deviceMap).map((item) => ({
        device: item.name,
        clicks: item.clicks,
      })),
      browsers: mapToArray(browserMap).map((item) => ({
        browser: item.name,
        clicks: item.clicks,
      })),
      timeline: Array.from(dateMap.entries())
        .map(([date, clicks]) => ({ date, clicks }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    };

    return { success: true, stats };
  } catch (error) {
    console.log(error);
    return { success: false, message: "server-error" };
  }
}

export interface UtmTreeNode {
  name: string;
  clicks: number;
  hasChildren: boolean;
}

export async function getUtmTreeData({
  campaignId,
  path,
}: {
  campaignId: string;
  path: {
    source?: string;
    medium?: string;
    term?: string;
  };
}): Promise<{
  success: boolean;
  message?: string;
  level?: "source" | "medium" | "term" | "content";
  data?: UtmTreeNode[];
  breadcrumb?: Array<{ level: string; value: string }>;
}> {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return { success: false, message: "no-user" };
    }
    const { plan } = await getUserPlan();
    if (plan !== "pro") {
      return { success: false, message: "plan-restricted" };
    }
    const sub = session.user.sub;
    await connectDB();

    const campaign = await Campaigns.findOne({ sub, _id: campaignId })
      .populate("links")
      .lean();
    if (!campaign) {
      return { success: false, message: "campaign-not-found" };
    }

    const links = campaign.links as unknown as Array<{ urlCode: string }>;
    const urlCodes = links.map((link) => link.urlCode);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const matchQuery: Record<string, any> = {
      urlCode: { $in: urlCodes },
      "queryParams.utm_campaign": campaign.title,
    };

    const breadcrumb: Array<{ level: string; value: string }> = [
      { level: "campaign", value: campaign.title },
    ];

    let currentLevel: "source" | "medium" | "term" | "content" = "source";
    let groupField = "queryParams.utm_source";

    if (path.source) {
      matchQuery["queryParams.utm_source"] = path.source;
      breadcrumb.push({ level: "source", value: path.source });
      currentLevel = "medium";
      groupField = "queryParams.utm_medium";
    }

    if (path.medium) {
      matchQuery["queryParams.utm_medium"] = path.medium;
      breadcrumb.push({ level: "medium", value: path.medium });
      currentLevel = "term";
      groupField = "queryParams.utm_term";
    }

    if (path.term) {
      matchQuery["queryParams.utm_term"] = path.term;
      breadcrumb.push({ level: "term", value: path.term });
      currentLevel = "content";
      groupField = "queryParams.utm_content";
    }

    const aggregation = await Clicks.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: `$${groupField}`,
          clicks: { $sum: 1 },
        },
      },
      { $sort: { clicks: -1 } },
    ]);

    const data: UtmTreeNode[] = aggregation
      .filter((item) => item._id && item._id.trim() !== "")
      .map((item) => ({
        name: item._id,
        clicks: item.clicks,
        hasChildren: currentLevel !== "content",
      }));

    return {
      success: true,
      level: currentLevel,
      data,
      breadcrumb,
    };
  } catch (error) {
    console.log(error);
    return { success: false, message: "server-error" };
  }
}

export async function exportCampaignData({
  campaignId,
  filters,
}: {
  campaignId: string;
  filters: {
    startDate?: Date;
    endDate?: Date;
    sources?: string[];
    mediums?: string[];
    terms?: string[];
    contents?: string[];
  };
}): Promise<{ success: boolean; message?: string; url?: string }> {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return { success: false, message: "no-user" };
    }
    const { plan } = await getUserPlan();
    if (plan !== "pro") {
      return { success: false, message: "plan-restricted" };
    }
    const sub = session.user.sub;
    await connectDB();

    const campaign = await Campaigns.findOne({ sub, _id: campaignId })
      .populate("links")
      .lean();
    if (!campaign) {
      return { success: false, message: "campaign-not-found" };
    }

    const links = campaign.links as unknown as Array<{ urlCode: string }>;
    const urlCodes = links.map((link) => link.urlCode);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const matchQuery: Record<string, any> = {
      urlCode: { $in: urlCodes },
      "queryParams.utm_campaign": campaign.title,
    };

    if (filters.startDate || filters.endDate) {
      matchQuery.timestamp = {};
      if (filters.startDate) matchQuery.timestamp.$gte = filters.startDate;
      if (filters.endDate) matchQuery.timestamp.$lte = filters.endDate;
    }

    if (filters.sources && filters.sources.length > 0) {
      matchQuery["queryParams.utm_source"] = { $in: filters.sources };
    }

    if (filters.mediums && filters.mediums.length > 0) {
      matchQuery["queryParams.utm_medium"] = { $in: filters.mediums };
    }

    if (filters.terms && filters.terms.length > 0) {
      matchQuery["queryParams.utm_term"] = { $in: filters.terms };
    }

    if (filters.contents && filters.contents.length > 0) {
      matchQuery["queryParams.utm_content"] = { $in: filters.contents };
    }

    const clicks = await Clicks.find(matchQuery)
      .select("-_id -__v -sub -type -ip")
      .lean();

    const mappedClicks: Record<string, string>[] = clicks.map((click) => ({
      "Link Code": click.urlCode || "",
      Campaign: click.queryParams?.utm_campaign || "",
      Source: click.queryParams?.utm_source || "",
      Medium: click.queryParams?.utm_medium || "",
      Term: click.queryParams?.utm_term || "",
      Content: click.queryParams?.utm_content || "",
      Country: click.country || "",
      Region: click.region || "",
      City: click.city || "",
      Timezone: click.timezone || "",
      Language: click.language || "",
      Browser: click.browser || "",
      OS: click.os || "",
      "Device Type": click.deviceType || "",
      Referrer: click.referrer || "",
      Date: format(click.timestamp, "yyyy-MM-dd HH:mm:ss"),
    }));

    const csv = parse(mappedClicks);
    const base64 = Buffer.from(csv).toString("base64");

    return { success: true, url: `data:text/csv;base64,${base64}` };
  } catch (error) {
    console.log(error);
    return { success: false, message: "server-error" };
  }
}
