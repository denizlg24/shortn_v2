"use server";

import { connectDB } from "@/lib/mongodb";
import UrlV3 from "@/models/url/UrlV3";
import { IUrl } from "@/models/url/UrlV3";

interface IFilters {
  tags: string[];
  customLink: "all" | "on" | "off";
  attachedQR: "all" | "on" | "off";
  sortBy: "date_asc" | "date_desc" | "clicks_asc" | "clicks_desc";
  query: string;
  page: number;
  limit: number;
  startDate?: string;
  endDate?: string;
}

export const getFilteredLinks = async (
  filters: IFilters,
  userSub: string
): Promise<{ links: IUrl[]; total: number }> => {
  await connectDB();

  const query: any = {
    sub: userSub,
    isQrCode: false,
  };
  console.log(filters);
  if (filters.startDate || filters.endDate) {
    query.date = {};
    if (filters.startDate) {
      query.date.$gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      query.date.$lte = new Date(filters.endDate);
    }
  }

  if (filters.query.trim()) {
    query.$text = { $search: filters.query.trim() };
  }

  if (filters.tags.length > 0) {
    query.tags = { $in: filters.tags };
  }

  if (filters.customLink === "on") {
    query.customCode = true;
  } else if (filters.customLink === "off") {
    query.customCode = false;
  }

  if (filters.attachedQR === "on") {
    query.qrCodeId = { $exists: true, $ne: null };
  } else if (filters.attachedQR === "off") {
    query.qrCodeId = { $in: [null, undefined, ""] };
  }

  let sort: Record<string, 1 | -1> = {};
  switch (filters.sortBy) {
    case "date_asc":
      sort = { date: 1 };
      break;
    case "date_desc":
      sort = { date: -1 };
      break;
    case "clicks_asc":
      sort = { "clicks.total": 1 };
      break;
    case "clicks_desc":
      sort = { "clicks.total": -1 };
      break;
  }

  const skip = (filters.page - 1) * filters.limit;
  console.log(query);
  const [links, total] = await Promise.all([
    UrlV3.find(query).sort(sort).skip(skip).limit(filters.limit).lean(),
    UrlV3.countDocuments(query),
  ]);

  const linksSanitized = links.map((link) => ({
    ...link,
    _id: link._id.toString(),
  }));

  return { links: linksSanitized, total };
};
