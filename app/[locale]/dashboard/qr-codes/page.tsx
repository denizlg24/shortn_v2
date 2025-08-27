import { getFilteredQRCodes } from "@/app/actions/qrCodeActions";
import { SortingControls } from "@/components/dashboard/links/sorting-controls";
import { QRCodesContainer } from "@/components/dashboard/qr-codes/qr-codes-container";
import { QRCodesFilterBar } from "@/components/dashboard/qr-codes/qr-codes-filter-bar";
import { parse } from "date-fns";
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
