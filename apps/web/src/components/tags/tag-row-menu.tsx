"use client";

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@shortn/ui";
import { Ellipsis, Link2, Merge, PenLine, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

/** Every tag action is a visible menu entry leading to its own page. */
export function TagRowMenu({
  name,
  base,
  linksHref,
  editable,
  deletable,
}: {
  name: string;
  base: string;
  linksHref: string;
  editable: boolean;
  deletable: boolean;
}) {
  const t = useTranslations("tags");
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("actionsFor", { tag: name })}
        >
          <Ellipsis aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuItem
          icon={<Link2 aria-hidden />}
          onSelect={() => router.push(linksHref)}
        >
          {t("viewLinks")}
        </DropdownMenuItem>
        {editable ? (
          <DropdownMenuItem
            icon={<PenLine aria-hidden />}
            onSelect={() => router.push(base)}
          >
            {t("edit")}
          </DropdownMenuItem>
        ) : null}
        {editable && deletable ? (
          <>
            <DropdownMenuItem
              icon={<Merge aria-hidden />}
              onSelect={() => router.push(`${base}/merge`)}
            >
              {t("merge")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              tone="danger"
              icon={<Trash2 aria-hidden />}
              onSelect={() => router.push(`${base}/delete`)}
            >
              {t("delete")}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
