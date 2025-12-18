"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormRootError,
} from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { useState, useEffect, ReactNode } from "react";
import { createCampaign, getUserCampaigns } from "@/app/actions/linkActions";
import { Plus, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Campaign = {
  _id: string;
  title: string;
  linksCount: number;
};

const campaignFormSchema = z.object({
  title: z
    .string()
    .min(1, "Campaign name is required")
    .max(100, "Campaign name can't be longer than 100 characters")
    .regex(
      /^[A-Za-z0-9 _-]+$/,
      "Campaign name can only contain letters, numbers, spaces, dashes (-), and underscores (_)",
    ),
});

export const CampaignSelectorDialog = ({
  selectedCampaign,
  onSelect,
  trigger,
}: {
  selectedCampaign?: { _id: unknown; title: string };
  onSelect: (campaign: { _id: string; title: string } | undefined) => void;
  trigger?: ReactNode;
}) => {
  const [open, setOpen] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const campaignForm = useForm<z.infer<typeof campaignFormSchema>>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: {
      title: "",
    },
  });

  useEffect(() => {
    const loadCampaigns = async () => {
      setLoading(true);
      const result = await getUserCampaigns();
      if (result.success) {
        setCampaigns(result.campaigns as Campaign[]);
      }
      setLoading(false);
    };
    if (open) {
      loadCampaigns();
      campaignForm.reset();
    }
  }, [open, campaignForm]);

  const handleCreateNew = async () => {
    setCreating(true);

    const valid = await campaignForm.trigger();
    if (!valid) {
      setCreating(false);
      return;
    }

    const data = campaignForm.getValues();
    const result = await createCampaign({
      title: data.title,
    });

    if (result.success && result.campaign) {
      toast.success("Campaign created");
      onSelect({
        _id: result.campaign._id,
        title: result.campaign.title,
      });
      setOpen(false);
      campaignForm.reset();
    } else {
      switch (result.message) {
        case "duplicate":
          campaignForm.setError("title", {
            message:
              "A campaign with this name already exists. Please choose another name.",
          });
          break;
        case "plan-restricted":
          campaignForm.setError("root", {
            message: "Campaigns require a Pro plan.",
          });
          break;
        case "no-user":
          campaignForm.setError("root", {
            message: "User not found. Please log in again.",
          });
          break;
        case "server-error":
          campaignForm.setError("root", {
            message: "Server error. Please try again later.",
          });
          break;
        default:
          campaignForm.setError("root", {
            message: "Failed to create campaign. Please try again.",
          });
      }
    }
    setCreating(false);
  };

  const handleSelectExisting = (campaign: Campaign) => {
    if (selectedCampaign?.title === campaign.title) {
      onSelect(undefined);
    } else {
      onSelect({
        _id: campaign._id,
        title: campaign.title,
      });
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <div className="w-full relative cursor-pointer">
            <Input
              readOnly
              value={selectedCampaign?.title || "Select or create a campaign"}
              className="text-left pl-6 cursor-pointer"
            />
            <ChevronDown className="w-4 h-4 left-1.5 top-1/2 -translate-y-1/2 absolute" />
          </div>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Select Campaign</DialogTitle>
          <DialogDescription>
            Select an existing campaign or create a new one.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="select" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="select">Select a campaign</TabsTrigger>
            <TabsTrigger value="create">Create a new campaign</TabsTrigger>
          </TabsList>
          <Separator className="mt-1" />
          <TabsContent value="select">
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold">Your Campaigns</h3>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner className="h-6 w-6" />
                </div>
              ) : campaigns.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No campaigns yet. Create one to get started!
                </p>
              ) : (
                <ScrollArea className="h-60 rounded-md border bg-muted p-2">
                  <div className="flex flex-col gap-2">
                    {campaigns.map((campaign) => {
                      const isSelected =
                        selectedCampaign?.title === campaign.title;
                      return (
                        <button
                          key={campaign._id}
                          onClick={() => handleSelectExisting(campaign)}
                          className={cn(
                            "bg-background flex items-center gap-3 p-3 rounded-lg border hover:bg-background/50 transition-colors text-left",
                            isSelected && "border-2 border-primary",
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                              {campaign.title}
                            </p>
                            <p className="text-sm text-muted-foreground truncate">
                              {campaign.linksCount} link
                              {campaign.linksCount !== 1 ? "s" : ""}
                            </p>
                          </div>
                          <Check
                            className={cn(
                              "h-4 w-4 shrink-0",
                              isSelected ? "opacity-100" : "opacity-0",
                            )}
                          />
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
              {selectedCampaign?.title && (
                <Button
                  variant="outline"
                  onClick={() => {
                    onSelect(undefined);
                    setOpen(false);
                  }}
                >
                  Clear Selection
                </Button>
              )}
            </div>
          </TabsContent>
          <TabsContent value="create">
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold">Create New Campaign</h3>
              <Form {...campaignForm}>
                <form className="flex flex-col gap-3">
                  <FormField
                    control={campaignForm.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Campaign Name *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., Black Friday 2025"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormRootError />
                  <Button
                    type="button"
                    onClick={handleCreateNew}
                    disabled={creating}
                  >
                    {creating ? (
                      <>
                        Creating...
                        <Spinner className="h-4 w-4" />
                      </>
                    ) : (
                      <>
                        Create & Select
                        <Plus className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
