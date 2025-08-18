"use client";

import { PaginationControls } from "@/components/ui/pagination-controls";
import { useRouter } from "@/i18n/navigation";
import { IQRCode } from "@/models/url/QRCodeV2";
import { Loader2 } from "lucide-react";
import { QRCodeCard } from "./qr-code-card";

export const QRCodesContainer = ({
  qrCodes,
  total,
  tags,
  page,
  limit,
}: {
  qrCodes: IQRCode[];
  total: number;
  tags: string[];
  page: number;
  limit: number;
}) => {
  const router = useRouter();

  const addTag = (tagId: string) => {
    const searchParams = new URLSearchParams(window.location.search);
    const currentTags = searchParams.get("tags");
    let tagIds: string[] = [];

    try {
      tagIds = currentTags ? JSON.parse(currentTags) : [];
    } catch {
      tagIds = [];
    }

    if (!tagIds.includes(tagId)) {
      tagIds.push(tagId);
    }

    searchParams.set("tags", JSON.stringify(tagIds));

    router.push(`?${searchParams.toString()}`);
  };

  const removeTag = (tagId: string) => {
    const searchParams = new URLSearchParams(window.location.search);
    const currentTags = searchParams.get("tags");
    let tagIds: string[] = [];

    try {
      tagIds = currentTags ? JSON.parse(currentTags) : [];
    } catch {
      tagIds = [];
    }

    tagIds = tagIds.filter((id) => id !== tagId);

    if (tagIds.length > 0) {
      searchParams.set("tags", JSON.stringify(tagIds));
    } else {
      searchParams.delete("tags");
    }

    router.push(`?${searchParams.toString()}`);
  };

  return (
    <div className="w-full col-span-full flex flex-col gap-4">
      {qrCodes.length > 0 ? (
        <>
          {qrCodes.map((code) => (
            <QRCodeCard
              key={code.qrCodeId}
              qrCode={code}
              addTag={addTag}
              removeTag={removeTag}
              tags={tags}
            />
          ))}
          {page >= Math.ceil(total / limit) && (
            <div className="w-full max-w-3xl flex flex-row items-center gap-4 mx-auto">
              <div className="h-1 grow w-[45%] bg-muted-foreground"></div>
              <p className="text-muted-foreground grow font-semibold w-full text-center">
                You've reached the end of your QR Codes
              </p>
              <div className="h-1 grow w-[45%] bg-muted-foreground"></div>
            </div>
          )}
        </>
      ) : (
        <div className="w-full max-w-3xl flex flex-row items-center gap-4 mx-auto">
          <div className="h-1 grow w-[45%] bg-muted-foreground"></div>
          <p className="text-muted-foreground font-semibold w-full text-center">
            You've reached the end of your QR Codes
          </p>
          <div className="h-1 grow w-[45%] bg-muted-foreground"></div>
        </div>
      )}
      {Math.ceil(total / limit) > 1 && (
        <PaginationControls totalPages={Math.ceil(total / limit)} />
      )}
    </div>
  );
};
