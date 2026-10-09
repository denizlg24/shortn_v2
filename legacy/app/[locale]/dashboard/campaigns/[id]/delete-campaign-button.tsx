"use client";

import { deleteCampaign } from "@/app/actions/linkActions";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

export const DeleteCampaignButton = ({
  className,
  title,
}: {
  className?: string;
  title: string;
}) => {
  const t = useTranslations("delete-campaign");
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();
  return (
    <Button
      onClick={async () => {
        setDeleting(true);
        const { success } = await deleteCampaign({ campaignTitle: title });
        if (success) {
          toast.success(t("toast-success"));
          router.push("/dashboard/campaigns");
        } else {
          toast.error(t("toast-error"));
        }
        setDeleting(false);
      }}
      disabled={deleting}
      className={className}
      variant={"outline"}
    >
      {deleting ? (
        <>
          {t("deleting")} <Loader2 className="animate-spin" />
        </>
      ) : (
        <>
          {t("delete")} <Trash2 />
        </>
      )}
    </Button>
  );
};
