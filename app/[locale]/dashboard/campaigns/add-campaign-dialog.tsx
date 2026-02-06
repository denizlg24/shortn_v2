"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCampaign } from "@/app/actions/linkActions";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

export const AddCampaignDialog = ({
  trigger,
}: {
  trigger?: React.ReactNode;
}) => {
  const t = useTranslations("add-campaign-dialog");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    if (!title.trim()) {
      setError(t("error-required"));
      return;
    }

    setCreating(true);
    setError("");

    const result = await createCampaign({ title: title.trim() });

    if (result.success && result.campaign) {
      toast.success(t("toast-success", { title }));
      setOpen(false);
      setTitle("");
      setCreating(false);
      router.push(`/dashboard/campaigns/${result.campaign._id}`);
    } else {
      switch (result.message) {
        case "duplicate":
          setError(t("error-duplicate"));
          break;
        case "plan-restricted":
          setError(t("error-plan-restricted"));
          break;
        default:
          setError(t("error-failed"));
      }
      setCreating(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setTitle("");
      setError("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="w-full">
            {t("create-campaign")} <Plus />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="campaign-name">{t("campaign-name-label")}</Label>
          <Input
            id="campaign-name"
            placeholder={t("placeholder")}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !creating) {
                handleCreate();
              }
            }}
            disabled={creating}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter className="flex flex-row items-center justify-end gap-2 sm:gap-2">
          <Button
            variant="secondary"
            onClick={() => handleOpenChange(false)}
            disabled={creating}
          >
            {t("cancel")}
          </Button>
          <Button onClick={handleCreate} disabled={creating || !title.trim()}>
            {creating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("creating")}
              </>
            ) : (
              <>{t("create")}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
