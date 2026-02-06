"use client";
import { NotepadText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

export const EmptyBiosCard = () => {
  const t = useTranslations("empty-bios-card");
  return (
    <Empty className="h-fit! flex-none!">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <NotepadText />
        </EmptyMedia>
        <EmptyTitle>{t("title")}</EmptyTitle>
        <EmptyDescription>{t("description")}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button className="w-full" asChild>
          <Link href={"/dashboard/pages/create"}>{t("create-page")}</Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
};
