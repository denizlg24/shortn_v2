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
export const EmptyBiosCard = () => {
  return (
    <Empty className="h-fit! flex-none!">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <NotepadText />
        </EmptyMedia>
        <EmptyTitle>No Pages Yet</EmptyTitle>
        <EmptyDescription>
          You haven&apos;t created any Link-in-bio pages yet. Get started by
          creating your first Link-in-bio page.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button className="w-full" asChild>
          <Link href={"/dashboard/pages/create"}>Create Page</Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
};
