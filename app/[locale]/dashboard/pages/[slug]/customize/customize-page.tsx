"use client";
import { Card } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { BioPageDisplay } from "@/app/b/bio-page-display";
import { useState } from "react";

export const CustomizeBioPage = ({
  initialBio,
}: {
  initialBio: {
    userId: string;
    slug: string;
    title: string;
    description?: string;
    avatarUrl?: string;
    theme?: {
      primaryColor?: string;
      background?: string;
      textColor?: string;
      buttonStyle?: "rounded" | "square" | "pill";
      header?: {
        headerStyle: "centered" | "left-aligned" | "right-aligned";
        headerImageUrl?: string;
        headerImageStyle: "square" | "rounded" | "circle";
        headerBackgroundImage?: string;
        headerBackgroundColor: string;
        headerTitle?: string;
        headerSubtitle?: string;
      };
    };
    links: {
      link: { shortUrl: string; title: string };
      image?: string;
      title?: string;
    }[];
    socials?: {
      instagram?: string;
      twitter?: string;
      github?: string;
      linkedin?: string;
    };
    createdAt: Date;
    updatedAt: Date;
  };
}) => {
  const [bio] = useState(initialBio);
  //const hasChanges = bio != initialBio;

  return (
    <div className="w-full max-w-7xl mx-auto flex lg:flex-row lg:items-start items-center gap-6 flex-col-reverse">
      <div className="grow w-full flex flex-col gap-6">
        <h1 className="font-black lg:text-3xl md:text-2xl text-xl">
          Customize your page
        </h1>
        <Card className="w-full"></Card>
      </div>

      <div className="hidden lg:flex w-full max-w-[375px] shrink-0 flex-col items-center gap-4">
        <h1 className="font-semibold text-base text-yellow-800 bg-yellow-50 px-3 py-1 rounded border border-yellow-800">
          Live preview
        </h1>
        <div className="w-full h-[550px] border rounded">
          <BioPageDisplay bio={bio} />
        </div>
      </div>

      <Collapsible className="lg:hidden w-full">
        <CollapsibleTrigger className="w-full group">
          <div className="flex items-center justify-between p-2! bg-background border rounded-md">
            <div className="font-semibold xs:text-sm text-xs text-yellow-800 bg-yellow-50 px-2 py-0.5 rounded border border-yellow-800">
              Live preview
            </div>
            <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="max-w-[375px] w-full h-[550px] border rounded mt-2">
            <BioPageDisplay bio={bio} />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};
