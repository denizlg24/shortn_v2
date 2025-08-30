import { auth } from "@/auth";
import { LinkContainer } from "@/components/dashboard/links/link-container";
import { LinkFilterBar } from "@/components/dashboard/links/link-filter-bar";
import { SortingControls } from "@/components/dashboard/links/sorting-controls";
import { connectDB } from "@/lib/mongodb";
import { ITag } from "@/models/url/Tag";
import UrlV3, { IUrl } from "@/models/url/UrlV3";
import { addDays, parse } from "date-fns";
import { setRequestLocale } from "next-intl/server";

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
  filters: IFilters
): Promise<{ links: IUrl[]; total: number }> => {
  const session = await auth();
  const user = session?.user;

  if (!user) {
    return {
      links: [],
      total: 0,
    };
  }
  const sub = user?.sub;
  await connectDB();

  const pipeline: any[] = [];

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
        index: "text-search",
        text: {
          query: filters.query.trim(),
          path: ["title", "longUrl", "tags.tagName"],
        },
      },
    });
  }

  // Always apply the match stage after $search
  pipeline.push({ $match: matchStage });

  // Sort
  let sortStage: Record<string, 1 | -1> = {};
  switch (filters.sortBy) {
    case "date_asc":
      sortStage = { date: 1 };
      break;
    case "date_desc":
      sortStage = { date: -1 };
      break;
    case "clicks_asc":
      sortStage = { "clicks.total": 1 };
      break;
    case "clicks_desc":
      sortStage = { "clicks.total": -1 };
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

  const linksSanitized = links.map((link) => ({
    ...link,
    _id: link._id.toString(),
    tags: link.tags?.map((tag: ITag) => ({
      ...tag,
      _id: (tag._id as any).toString(),
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
      Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())
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

  return (
    <main className="flex flex-col items-center w-full mx-auto md:gap-0 gap-2 bg-accent px-4 sm:pt-14! pt-6! pb-16">
      <div className="w-full max-w-6xl mx-auto grid grid-cols-6 gap-6">
        <h1 className="col-span-full lg:text-3xl md:text-2xl sm:text-xl text-lg font-bold">
          Your Shortn Links
        </h1>
        <LinkFilterBar />
        <SortingControls
          label="Sort links by"
          className="-mt-3 col-span-full"
        />

        <LinkContainer
          links={links}
          total={total}
          limit={filters.limit}
          page={filters.page}
          tags={filters.tags}
        />
      </div>
    </main>
  );
}
