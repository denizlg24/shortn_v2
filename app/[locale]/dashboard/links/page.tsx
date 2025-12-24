import { LinkContainer } from "@/components/dashboard/links/link-container";
import { LinkFilterBar } from "@/components/dashboard/links/link-filter-bar";
import { SortingControls } from "@/components/dashboard/links/sorting-controls";
import { connectDB } from "@/lib/mongodb";
import { getServerSession } from "@/lib/session";
import { BioPage } from "@/models/link-in-bio/BioPage";
import { TagT } from "@/models/url/Tag";
import UrlV3, { IUrl, TUrl } from "@/models/url/UrlV3";
import { addDays, parse } from "date-fns";
import { setRequestLocale } from "next-intl/server";
import env from "@/utils/env";

interface IFilters {
  tags: string[];
  customLink: "all" | "on" | "off";
  attachedQR: "all" | "on" | "off";
  sortBy: "date_asc" | "date_desc" | "clicks_asc" | "clicks_desc";
  query: string;
  page: number;
  limit: number;
  startDate?: Date;
  endDate?: Date;
}

const getFilteredLinks = async (
  filters: IFilters,
): Promise<{ links: TUrl[]; total: number }> => {
  const session = await getServerSession();
  const user = session?.user;

  if (!user) {
    return {
      links: [],
      total: 0,
    };
  }
  const sub = user?.sub;
  await connectDB();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pipeline: any[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const matchStage: any = {
    sub,
    isQrCode: false,
  };

  if (filters.startDate || filters.endDate) {
    matchStage.date = {};
    if (filters.startDate) {
      matchStage.date.$gte = filters.startDate;
    }
    if (filters.endDate) {
      matchStage.date.$lte = addDays(filters.endDate, 1);
    }
  }

  if (filters.tags.length > 0) {
    matchStage.tags = { $elemMatch: { id: { $in: filters.tags } } };
  }

  if (filters.customLink === "on") {
    matchStage.customCode = true;
  } else if (filters.customLink === "off") {
    matchStage.customCode = false;
  }

  if (filters.attachedQR === "on") {
    matchStage.qrCodeId = {
      $exists: true,
      $ne: null,
      $not: { $eq: "" },
    };
  } else if (filters.attachedQR === "off") {
    matchStage.qrCodeId = { $in: [null, undefined, ""] };
  }

  if (filters.query.trim()) {
    pipeline.push({
      $search: {
        index: env.ATLAS_SEARCH_INDEX_LINKS || "dev-urlv3",
        text: {
          query: filters.query.trim(),
          path: ["title", "longUrl", "tags.tagName"],
        },
      },
    });
    // Add score-based filtering to prioritize relevant results
    pipeline.push({
      $addFields: {
        searchScore: { $meta: "searchScore" },
      },
    });
    // Only include results with a minimum relevance score
    pipeline.push({
      $match: {
        searchScore: { $gte: 0.5 },
      },
    });
  }
  pipeline.push({ $match: matchStage });

  let sortStage: Record<string, 1 | -1> = {};

  // When searching, prioritize search score first, then apply user sorting
  if (filters.query.trim()) {
    sortStage = { searchScore: -1 };
  }

  switch (filters.sortBy) {
    case "date_asc":
      sortStage = { ...sortStage, date: 1 };
      break;
    case "date_desc":
      sortStage = { ...sortStage, date: -1 };
      break;
    case "clicks_asc":
      sortStage = { ...sortStage, "clicks.total": 1 };
      break;
    case "clicks_desc":
      sortStage = { ...sortStage, "clicks.total": -1 };
      break;
  }
  pipeline.push({ $sort: sortStage });

  const skip = (filters.page - 1) * filters.limit;
  pipeline.push({ $skip: skip });
  pipeline.push({ $limit: filters.limit });

  const countPipeline = [
    ...pipeline.filter((stage) => !("$skip" in stage || "$limit" in stage)),
    {
      $count: "total",
    },
  ];

  const [links, totalResult] = await Promise.all([
    UrlV3.aggregate(pipeline).exec(),
    UrlV3.aggregate(countPipeline).exec(),
  ]);

  const total = totalResult[0]?.total || 0;

  const linksSanitized = links.map((link: IUrl) => ({
    ...link,
    _id: (link._id as string).toString(),
    utmLinks: link.utmLinks?.map((utm) => ({
      ...utm,
      _id: (utm._id as string).toString(),
      ...(utm.campaign?.title
        ? {
            campaign: {
              title: utm.campaign.title,
              _id: (utm.campaign._id as string).toString(),
            },
          }
        : {}),
    })),
    tags: link.tags?.map((tag: TagT & { _id: unknown }) => ({
      ...tag,
      _id: (tag._id as string).toString(),
    })),
  }));

  return { links: linksSanitized, total };
};

export default async function Home({
  params,
  searchParams,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: any;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  function parseToUTC(dateStr: string): Date {
    const parsed = parse(dateStr, "MM-dd-yyyy", new Date());
    return new Date(
      Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()),
    );
  }

  let tagIds: string[] = [];
  const tagsParam = (await searchParams).tags;
  if (tagsParam) {
    try {
      tagIds = JSON.parse(tagsParam);
    } catch (err) {
      console.error("Invalid tag param:", err);
    }
  }

  const dateParsed = {
    from: (await searchParams).startDate
      ? parseToUTC((await searchParams).startDate!)
      : undefined,
    to: (await searchParams).endDate
      ? parseToUTC((await searchParams).endDate!)
      : undefined,
  };
  const filters: IFilters = {
    tags: tagIds,
    customLink:
      ((await searchParams).customLink as IFilters["customLink"]) || "all",
    attachedQR:
      ((await searchParams).attachedQR as IFilters["attachedQR"]) || "all",
    sortBy: ((await searchParams).sortBy as IFilters["sortBy"]) || "date_desc",
    query: (await searchParams).query || "",
    page: parseInt((await searchParams).page || "1", 10),
    limit: parseInt((await searchParams).limit || "10", 10),
    startDate: dateParsed.from || undefined,
    endDate: dateParsed.to || undefined,
  };

  const { links, total } = await getFilteredLinks(filters);

  const linksWithBioPageSlug = await Promise.all(
    links.map(async (link) => {
      const page = await BioPage.findOne({
        links: { $elemMatch: { link: link._id } },
      });
      return { ...link, bioPageSlug: page?.slug };
    }),
  );

  return (
    <main className="flex flex-col items-center w-full mx-auto md:gap-0 gap-2 bg-accent px-4 sm:pt-14! pt-6! pb-16">
      <div className="w-full max-w-6xl mx-auto grid grid-cols-6 gap-6">
        <div className="col-span-full flex flex-col gap-1">
          <h1 className="lg:text-3xl md:text-2xl sm:text-xl text-lg font-bold">
            Your Shortn Links
          </h1>
          <p className="text-xs text-muted-foreground">
            {total > 0
              ? `Displaying ${(filters.page - 1) * filters.limit + 1}-${Math.min(filters.page * filters.limit, total)} of ${total} link${total !== 1 ? "s" : ""}`
              : "No links found"}
          </p>
        </div>
        <LinkFilterBar />
        <SortingControls
          label="Sort links by"
          className="-mt-3 col-span-full"
        />

        <LinkContainer
          links={linksWithBioPageSlug}
          total={total}
          limit={filters.limit}
          page={filters.page}
          tags={filters.tags}
        />
      </div>
    </main>
  );
}
