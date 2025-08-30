import { auth } from "@/auth";
import { LinkDetails } from "@/components/dashboard/links/link-details";
import { connectDB } from "@/lib/mongodb";
import QRCodeV2 from "@/models/url/QRCodeV2";
import UrlV3 from "@/models/url/UrlV3";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

export const getShortn = async (urlCode: string) => {
  try {
    const session = await auth();
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
    };
    return { success: true, url: filtered };
  } catch (error) {
    return { success: false, url: undefined };
  }
};

export const getQRCode = async (codeID: string) => {
  try {
    const session = await auth();
    const user = session?.user;

    if (!user) {
      return {
        success: false,
        message: "no-user",
      };
    }
    const sub = user?.sub;
    await connectDB();
    const qr = await QRCodeV2.findOne({ sub, qrCodeId: codeID }).lean();
    if (!qr) {
      return { success: false, qr: undefined };
    }
    const filtered = {
      ...qr,
      _id: qr._id.toString(),
      tags: qr.tags?.map((tag) => ({ ...tag, _id: tag._id.toString() })),
    };
    return { success: true, qr: filtered };
  } catch (error) {
    return { success: false, qr: undefined };
  }
};

export default async function Home({
  params,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: Promise<{ locale: string; urlCode: string }>;
}) {
  const { locale, urlCode } = await params;
  setRequestLocale(locale);

  const { success, url } = await getShortn(urlCode);
  if (!success || !url) {
    notFound();
  }
  const { success: qrCodeSuccess, qr } = url.qrCodeId
    ? await getQRCode(url.qrCodeId)
    : { success: true, qr: undefined };

  return (
    <main className="flex flex-col items-center w-full mx-auto md:gap-0 gap-2 bg-accent px-4 sm:pt-14! pt-6! pb-16">
      <div className="w-full max-w-6xl mx-auto grid grid-cols-6 gap-6">
        <div className="w-full col-span-full flex flex-col gap-4">
          <LinkDetails urlCode={urlCode} url={url} qr={qr} />
        </div>
      </div>
    </main>
  );
}
