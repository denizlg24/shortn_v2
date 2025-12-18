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

export const AddCampaignDialog = ({
  trigger,
}: {
  trigger?: React.ReactNode;
}) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    if (!title.trim()) {
      setError("Campaign name is required");
      return;
    }

    setCreating(true);
    setError("");

    const result = await createCampaign({ title: title.trim() });

    if (result.success && result.campaign) {
      toast.success(`Campaign "${title}" created successfully`);
      setOpen(false);
      setTitle("");
      router.push(`/dashboard/campaigns/${result.campaign._id}`);
      router.refresh();
    } else {
      switch (result.message) {
        case "duplicate":
          setError("A campaign with this name already exists");
          break;
        case "plan-restricted":
          setError("Campaigns are only available for Pro users");
          break;
        default:
          setError("Failed to create campaign");
      }
    }
    setCreating(false);
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
            Create campaign <Plus />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Campaign</DialogTitle>
          <DialogDescription>
            Create a campaign to group your links and track aggregated
            analytics.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="campaign-name">Campaign Name</Label>
          <Input
            id="campaign-name"
            placeholder="e.g., Summer Sale 2025"
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
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={creating || !title.trim()}>
            {creating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>Create</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
