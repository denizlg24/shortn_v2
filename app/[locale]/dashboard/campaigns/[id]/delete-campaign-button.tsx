"use client";

import { deleteCampaign } from "@/app/actions/linkActions";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const DeleteCampaignButton = ({
  className,
  title,
}: {
  className?: string;
  title: string;
}) => {
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();
  return (
    <Button
      onClick={async () => {
        setDeleting(true);
        const { success } = await deleteCampaign({ campaignTitle: title });
        if (success) {
          toast.success("Your campaign was deleted successfully");
          router.push("/dashboard/campaigns");
        } else {
          toast.error("There was a problem deleting your campaign");
        }
        setDeleting(false);
      }}
      disabled={deleting}
      className={className}
      variant={"outline"}
    >
      {deleting ? (
        <>
          Deleting... <Loader2 className="animate-spin" />
        </>
      ) : (
        <>
          Delete Campaign <Trash2 />
        </>
      )}
    </Button>
  );
};
