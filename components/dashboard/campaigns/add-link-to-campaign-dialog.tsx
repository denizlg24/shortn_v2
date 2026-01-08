"use client";

import { useState, useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { searchUserLinks, addLinkToCampaign } from "@/app/actions/linkActions";
import { Check, ExternalLink, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface LinkResult {
  _id: string;
  urlCode: string;
  title?: string;
  shortUrl: string;
  longUrl: string;
}

export const AddLinkToCampaignDialog = ({
  campaignTitle,
  trigger,
  onLinkAdded,
}: {
  campaignTitle: string;
  trigger?: React.ReactNode;
  onLinkAdded?: (link: { urlCode: string; title: string }) => void;
}) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [links, setLinks] = useState<LinkResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);

  useEffect(() => {
    const fetchLinks = async () => {
      setLoading(true);
      const result = await searchUserLinks({
        query: query.trim() || undefined,
        excludeCampaign: campaignTitle,
        limit: 10,
      });
      if (result.success) {
        setLinks(result.links);
      }
      setLoading(false);
    };

    const debounce = setTimeout(fetchLinks, 300);
    return () => clearTimeout(debounce);
  }, [open, query, campaignTitle]);

  const handleAddLink = async (link: LinkResult) => {
    setAdding(link.urlCode);
    const result = await addLinkToCampaign({
      urlCode: link.urlCode,
      campaignTitle,
    });

    if (result.success) {
      toast.success(`Added "${link.title || link.urlCode}" to campaign`);
      setOpen(false);
      if (onLinkAdded) {
        onLinkAdded({
          urlCode: link.urlCode,
          title: link.title || link.urlCode,
        });
      } else {
        router.refresh();
      }
    } else {
      switch (result.message) {
        case "already-in-campaign":
          toast.error("This link is already in the campaign");
          break;
        case "url-not-found":
          toast.error("Link not found");
          break;
        default:
          toast.error("Failed to add link to campaign");
      }
    }
    setAdding(null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        setOpen(newOpen);
        if (!newOpen) {
          setQuery("");
          setLinks([]);
        }
      }}
    >
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            Add a Link <Plus />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Link to Campaign</DialogTitle>
          <DialogDescription>
            Search for a link to add to &quot;{campaignTitle}&quot;
          </DialogDescription>
        </DialogHeader>
        <Command className="rounded-lg border" shouldFilter={false}>
          <CommandInput
            placeholder="Search links by title, URL, or code..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className="max-h-[300px]">
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : links.length === 0 ? (
              <CommandEmpty>
                {query
                  ? "No links found matching your search"
                  : "No links available to add"}
              </CommandEmpty>
            ) : (
              <CommandGroup>
                {links.map((link) => (
                  <CommandItem
                    key={link._id}
                    value={link.urlCode}
                    onSelect={() => handleAddLink(link)}
                    className={cn(
                      "flex flex-col items-start gap-1 py-3 cursor-pointer",
                      adding === link.urlCode && "opacity-50",
                    )}
                    disabled={adding !== null}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-medium text-sm truncate max-w-[280px]">
                        {link.title || link.urlCode}
                      </span>
                      {adding === link.urlCode ? (
                        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                      ) : (
                        <Check className="w-4 h-4 opacity-0 group-aria-selected:opacity-100 shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground w-full">
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      <span className="truncate">
                        {link.shortUrl.replace("www.", "").split("://")[1]}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
};
