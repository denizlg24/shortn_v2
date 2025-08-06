"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import Image from "next/image";
import ctaImg from "@/public/dashboard-pages-inspire-action.webp";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useUser } from "@/utils/UserContext";

export const PagesCTA = ({
  className,
  organization,
}: {
  className?: string;
  organization: string;
}) => {
  const { user } = useUser();
  return (
    <Card
      className={cn("p-4 w-full flex flex-row gap-4 items-center", className)}
    >
      <Image
        src={ctaImg}
        alt="pages call to action img"
        className="h-full w-auto aspect-[65/112] object-fit max-w-[130px]"
      />
      <div className="grow flex flex-col gap-4">
        <h1 className="font-bold lg:text-xl md:text-lg text-base">
          Pages that inspire action
        </h1>
        <p className="md:text-sm text-xs">
          Customize your page with ease, track user engagement, and turn visits
          into conversions.
        </p>
        <Button variant="outline" asChild>
          <Link href={`/dashboard/${organization}/pages`}>
            Get Started <ArrowRight className="text-primary" />
          </Link>
        </Button>
      </div>
    </Card>
  );
};
