import { SortingControls } from "@/components/dashboard/links/sorting-controls";
import { QRCodesContainer } from "@/components/dashboard/qr-codes/qr-codes-container";
import { QRCodesFilterBar } from "@/components/dashboard/qr-codes/qr-codes-filter-bar";
import { connectDB } from "@/lib/mongodb";
import { getServerSession } from "@/lib/session";
import QRCodeV2, { IQRCode } from "@/models/url/QRCodeV2";
import { ITag } from "@/models/url/Tag";
import { addDays, parse } from "date-fns";
import { setRequestLocale } from "next-intl/server";
interface IFilters {
  tags: string[];
  attachedQR: "all" | "on" | "off";
  sortBy: "date_asc" | "date_desc" | "clicks_asc" | "clicks_desc";
  query: string;
  page: number;
  limit: number;
  startDate?: Date;
  endDate?: Date;
}

const getFilteredQRCodes = async (
  filters: IFilters,
): Promise<{ qrcodes: IQRCode[]; total: number }> => {
  const session = await getServerSession();
  const user = session?.user;

  if (!user) {
    return {
      qrcodes: [],
      total: 0,
    };
  }

  const controller = new AbortController();

  const sub = user?.sub;

  await connectDB();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pipeline: any[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const matchStage: any = {
    sub,
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

  if (filters.attachedQR === "on") {
    matchStage.attachedUrl = {
      $exists: true,
      $ne: null,
      $not: { $eq: "" },
    };
  } else if (filters.attachedQR === "off") {
    matchStage.attachedUrl = { $in: [null, undefined, ""] };
  }

  if (filters.query.trim()) {
    pipeline.push({
      $search: {
        index: "qr-code-text-search",
        text: {
          query: filters.query.trim(),
          path: ["title", "longUrl", "tags.tagName"],
        },
      },
    });
  }

  pipeline.push({ $match: matchStage });

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
    { $count: "total" },
  ];

  const [qrcodes, totalResult] = await Promise.all([
    QRCodeV2.aggregate(pipeline, { signal: controller.signal }).exec(),
    QRCodeV2.aggregate(countPipeline, { signal: controller.signal }).exec(),
  ]);

  const total = totalResult[0]?.total || 0;

  const qrcodesSanitized = qrcodes.map((qrcode) => ({
    ...qrcode,
    _id: qrcode._id.toString(),
    tags: qrcode.tags?.map((tag: ITag) => ({
      ...tag,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      _id: (tag._id as any).toString(),
    })),
  }));

  return { qrcodes: qrcodesSanitized, total };
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
    attachedQR:
      ((await searchParams).attachedQR as IFilters["attachedQR"]) || "all",
    sortBy: ((await searchParams).sortBy as IFilters["sortBy"]) || "date_desc",
    query: (await searchParams).query || "",
    page: parseInt((await searchParams).page || "1", 10),
    limit: parseInt((await searchParams).limit || "10", 10),
    startDate: dateParsed.from || undefined,
    endDate: dateParsed.to || undefined,
  };

  const { qrcodes, total } = await getFilteredQRCodes(filters);

  return (
    <main className="flex flex-col items-center w-full mx-auto md:gap-0 gap-2 bg-accent px-4 sm:pt-14! pt-6! pb-16">
      <div className="w-full max-w-6xl mx-auto grid grid-cols-6 gap-6">
        <h1 className="col-span-full lg:text-3xl md:text-2xl sm:text-xl text-lg font-bold">
          Your QR Codes
        </h1>
        <QRCodesFilterBar />
        <SortingControls
          label="Sort codes by"
          className="-mt-3 col-span-full"
        />
        <QRCodesContainer
          qrCodes={qrcodes}
          total={total}
          tags={filters.tags}
          page={filters.page}
          limit={filters.limit}
        />
      </div>
    </main>
  );
}
