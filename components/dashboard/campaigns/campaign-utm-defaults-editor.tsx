"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  X,
  Plus,
  Save,
  Megaphone,
  Share2,
  Tag,
  FileText,
  Loader2,
  Info,
} from "lucide-react";
import { updateCampaignDefaults } from "@/app/actions/linkActions";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { IUtmDefaults } from "@/models/url/Campaigns";

interface CampaignUtmDefaultsEditorProps {
  campaignId: string;
  initialDescription?: string;
  initialDefaults?: IUtmDefaults;
  onUpdate?: (data: {
    description?: string;
    utmDefaults?: IUtmDefaults;
  }) => void;
}

interface TagInputProps {
  label: string;
  icon: React.ReactNode;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  helpText: string;
}

const TagInput = ({
  label,
  icon,
  values,
  onChange,
  placeholder,
  helpText,
}: TagInputProps) => {
  const [inputValue, setInputValue] = useState("");

  const handleAdd = () => {
    const trimmed = inputValue
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-_]/g, "");
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
      setInputValue("");
    }
  };

  const handleRemove = (valueToRemove: string) => {
    onChange(values.filter((v) => v !== valueToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-md bg-muted text-muted-foreground">
          {icon}
        </div>
        <Label className="font-medium">{label}</Label>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[200px]">
              <p className="text-xs">{helpText}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div className="flex flex-wrap gap-2 min-h-9 p-2 border rounded-lg bg-background">
        {values.map((value) => (
          <Badge
            key={value}
            variant="secondary"
            className="flex items-center gap-1 pr-1 text-xs"
          >
            {value}
            <button
              type="button"
              onClick={() => handleRemove(value)}
              className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </Badge>
        ))}
        <div className="flex items-center gap-1 flex-1 min-w-[120px]">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="border-0 shadow-none h-7 px-1 text-sm focus-visible:ring-0"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleAdd}
            disabled={!inputValue.trim()}
            className="h-6 w-6 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export function CampaignUtmDefaultsEditor({
  campaignId,
  initialDescription = "",
  initialDefaults,
  onUpdate,
}: CampaignUtmDefaultsEditorProps) {
  const [saving, setSaving] = useState(false);
  const [description, setDescription] = useState(initialDescription);
  const [sources, setSources] = useState<string[]>(
    initialDefaults?.sources || [],
  );
  const [mediums, setMediums] = useState<string[]>(
    initialDefaults?.mediums || [],
  );
  const [terms, setTerms] = useState<string[]>(initialDefaults?.terms || []);
  const [contents, setContents] = useState<string[]>(
    initialDefaults?.contents || [],
  );

  const hasChanges =
    description !== initialDescription ||
    JSON.stringify(sources) !==
      JSON.stringify(initialDefaults?.sources || []) ||
    JSON.stringify(mediums) !==
      JSON.stringify(initialDefaults?.mediums || []) ||
    JSON.stringify(terms) !== JSON.stringify(initialDefaults?.terms || []) ||
    JSON.stringify(contents) !==
      JSON.stringify(initialDefaults?.contents || []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await updateCampaignDefaults({
        campaignId,
        description,
        utmDefaults: {
          sources,
          mediums,
          terms,
          contents,
        },
      });

      if (result.success) {
        toast.success("Campaign defaults saved successfully");
        onUpdate?.({
          description,
          utmDefaults: { sources, mediums, terms, contents },
        });
      } else {
        toast.error(result.message || "Failed to save campaign defaults");
      }
    } catch (error) {
      console.error("Failed to save:", error);
      toast.error("An error occurred while saving");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setDescription(initialDescription);
    setSources(initialDefaults?.sources || []);
    setMediums(initialDefaults?.mediums || []);
    setTerms(initialDefaults?.terms || []);
    setContents(initialDefaults?.contents || []);
  };

  return (
    <Card className="w-full">
      <div className="px-6 py-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-lg">Campaign Settings</CardTitle>
            <CardDescription>
              Configure default UTM parameters that auto-populate when adding
              links
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {hasChanges && (
              <Button variant="ghost" size="sm" onClick={handleReset}>
                Reset
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className={cn(
                "transition-all duration-200",
                hasChanges && "animate-pulse-subtle",
              )}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-1.5" />
              )}
              Save Changes
            </Button>
          </div>
        </div>
      </div>

      <CardContent className="px-6 py-0 space-y-6">
        <div className="space-y-2">
          <Label htmlFor="description" className="font-medium">
            Description
          </Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add a description for this campaign..."
            className="resize-none h-20"
          />
          <p className="text-xs text-muted-foreground">
            A brief description to help identify this campaign's purpose
          </p>
        </div>

        <div className="pt-2 border-t">
          <p className="text-sm font-medium mb-4 text-muted-foreground">
            UTM Parameter Defaults
          </p>
          <div className="grid gap-5">
            <TagInput
              label="Sources"
              icon={<Megaphone className="w-4 h-4" />}
              values={sources}
              onChange={setSources}
              placeholder="Add source..."
              helpText="e.g., facebook, twitter, newsletter - identifies where traffic comes from"
            />
            <TagInput
              label="Mediums"
              icon={<Share2 className="w-4 h-4" />}
              values={mediums}
              onChange={setMediums}
              placeholder="Add medium..."
              helpText="e.g., social, email, cpc - identifies the marketing medium"
            />
            <TagInput
              label="Terms"
              icon={<Tag className="w-4 h-4" />}
              values={terms}
              onChange={setTerms}
              placeholder="Add term..."
              helpText="e.g., promo, sale, launch - identifies paid keywords"
            />
            <TagInput
              label="Contents"
              icon={<FileText className="w-4 h-4" />}
              values={contents}
              onChange={setContents}
              placeholder="Add content..."
              helpText="e.g., header-cta, footer-link - differentiates similar content"
            />
          </div>
        </div>

        {(sources.length > 0 ||
          mediums.length > 0 ||
          terms.length > 0 ||
          contents.length > 0) && (
          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground mb-2">
              These defaults will be available when adding links to this
              campaign
            </p>
            <div className="flex flex-wrap gap-2">
              {sources.map((s) => (
                <Badge key={`s-${s}`} variant="outline" className="text-xs">
                  source: {s}
                </Badge>
              ))}
              {mediums.map((m) => (
                <Badge key={`m-${m}`} variant="outline" className="text-xs">
                  medium: {m}
                </Badge>
              ))}
              {terms.map((t) => (
                <Badge key={`t-${t}`} variant="outline" className="text-xs">
                  term: {t}
                </Badge>
              ))}
              {contents.map((c) => (
                <Badge key={`c-${c}`} variant="outline" className="text-xs">
                  content: {c}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
