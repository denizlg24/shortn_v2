"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { FilterCombobox } from "../page/filters";
import { searchLinkTagsAction } from "@/server/actions/link-tags";

export function RemoteLinkTags({
  workspace,
  initial,
}: {
  workspace: string;
  initial: string[];
}) {
  const t = useTranslations("linkPages.list"),
    messages = useTranslations("page.filters");
  const [options, setOptions] = useState(
      initial.map((name) => ({ value: name, label: name })),
    ),
    [failure, setFailure] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    sequence = useRef(0);
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      sequence.current++;
    },
    [],
  );
  const search = useCallback(
    (value: string) => {
      clearTimeout(timer.current);
      const current = ++sequence.current;
      timer.current = setTimeout(() => {
        void searchLinkTagsAction(workspace, value.slice(0, 200))
          .then((result) => {
            if (current !== sequence.current) return;
            setOptions(result.items);
            setFailure(Boolean(result.error));
          })
          .catch(() => {
            if (current === sequence.current) setFailure(true);
          });
      }, 250);
    },
    [workspace],
  );
  return (
    <div className="w-full sm:w-48">
      <FilterCombobox
        multiple
        label={t("tag")}
        name="tag"
        allLabel={t("anyTag")}
        options={options}
        onSearchChange={search}
      />
      <p
        role={failure ? "status" : undefined}
        className="mt-1 text-meta text-fg-muted"
      >
        {messages(failure ? "failedOptions" : "remoteOptions")}
      </p>
    </div>
  );
}
