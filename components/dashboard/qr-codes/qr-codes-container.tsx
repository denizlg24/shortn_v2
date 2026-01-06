"use client";

import { PaginationControls } from "@/components/ui/pagination-controls";
import { useRouter } from "@/i18n/navigation";
import { IQRCode } from "@/models/url/QRCodeV2";
import { QRCodeCard } from "./qr-code-card";
import { fetchApi } from "@/lib/utils";
import { useEffect, useState, useCallback } from "react";
import { ITag } from "@/models/url/Tag";
import { getCurrentUsage, UsageData } from "@/app/actions/usageActions";
import { usePlan } from "@/hooks/use-plan";

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
  const { plan } = usePlan();

  const [tagOptions, setTagOptions] = useState<ITag[]>([]);
  const [tagSearchInput, setTagSearchInput] = useState("");

  const [usage, setUsage] = useState<UsageData | null>(null);
  const fetchUsage = useCallback(async () => {
    const result = await getCurrentUsage();
    if (result.success && result.data) setUsage(result.data);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchUsage();
  }, [fetchUsage]);

  const linksLeft =
    plan !== "pro"
      ? (usage?.links.limit ?? 0) - (usage?.links.consumed ?? 0)
      : undefined;

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      const endpoint =
        tagSearchInput.trim() === "" ? "tags" : `tags?q=${tagSearchInput}`;
      fetchApi<{ tags: ITag[] }>(endpoint).then((res) => {
        if (res.success) {
          setTagOptions(res.tags);
        }
      });
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [tagSearchInput]);

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
              qrCode={{ ...code, _id: (code._id as string).toString() }}
              addTag={addTag}
              removeTag={removeTag}
              tags={tags}
              tagOptions={tagOptions}
              onTagSearchChange={setTagSearchInput}
              linksLeft={linksLeft}
            />
          ))}
          {page >= Math.ceil(total / limit) && (
            <div className="w-full max-w-3xl flex flex-row items-center gap-4 mx-auto">
              <div className="h-1 grow w-[45%] bg-muted-foreground"></div>
              <p className="text-muted-foreground grow font-semibold w-full text-center">
                You&apos;ve reached the end of your QR Codes
              </p>
              <div className="h-1 grow w-[45%] bg-muted-foreground"></div>
            </div>
          )}
        </>
      ) : (
        <div className="w-full max-w-3xl flex flex-row items-center gap-4 mx-auto">
          <div className="h-1 grow w-[45%] bg-muted-foreground"></div>
          <p className="text-muted-foreground font-semibold w-full text-center">
            You&apos;ve reached the end of your QR Codes
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
