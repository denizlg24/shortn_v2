"use client";

import {
  KeyboardHint,
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  type KeyboardHintProps,
} from "@shortn/ui";
import { useTranslations } from "next-intl";
import { allNav } from "./nav";

interface ShortcutRow {
  label: string;
  keys: KeyboardHintProps["keys"];
  sequence?: boolean;
}

export function ShortcutsSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("shell.shortcuts");
  const tNav = useTranslations("nav");
  const groups: Array<{ title: string; rows: ShortcutRow[] }> = [
    {
      title: t("general"),
      rows: [
        { label: t("palette"), keys: ["mod", "k"] },
        { label: t("switchWorkspace"), keys: ["mod", "o"] },
        { label: t("help"), keys: "?" },
      ],
    },
    {
      title: t("navigation"),
      rows: allNav.map((item) => ({
        label: t("goTo", { section: tNav(item.section) }),
        keys: ["g", item.goKey],
        sequence: true,
      })),
    },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{t("title")}</SheetTitle>
          <SheetDescription>{t("description")}</SheetDescription>
        </SheetHeader>
        <SheetBody className="flex flex-col gap-7">
          {groups.map((group) => (
            <section key={group.title}>
              <h3 className="mb-1 text-meta font-medium text-fg-subtle">
                {group.title}
              </h3>
              <dl>
                {group.rows.map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between gap-4 border-b border-line py-2.5 last:border-b-0"
                  >
                    <dt className="text-small">{row.label}</dt>
                    <dd>
                      <KeyboardHint
                        keys={row.keys}
                        {...(row.sequence ? { sequence: true } : {})}
                      />
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
