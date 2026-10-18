"use client";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useTranslations } from "next-intl";
import { Button, Combobox, buttonVariants } from "@shortn/ui";
import {
  moveLinksToCampaignAction,
  searchCampaignTargetsAction,
} from "@/server/actions/bulk-link-campaign";
export interface CampaignTarget {
  id: string;
  title: string;
  linkCount: number;
}
export interface CampaignTargetPage {
  items: CampaignTarget[];
  total: number | null;
  nextCursor: string | null;
}
export function BulkCampaignForm({
  workspace,
  selectionRef,
  count,
  initial,
}: {
  workspace: string;
  selectionRef: string;
  count: number;
  initial: CampaignTargetPage;
}) {
  const t = useTranslations("bulkCampaign"),
    [page, setPage] = useState(initial),
    [index, setIndex] = useState(0),
    [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [choice, setChoice] = useState<CampaignTarget | null>(null),
    [confirmed, setConfirmed] = useState(false),
    [loading, setLoading] = useState(false),
    [pickerError, setPickerError] = useState("");
  const [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState<{
      selected: number;
      updated: number;
      campaign: { id: string; title: string };
    } | null>(null);
  const query = useRef(""),
    sequence = useRef(0),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    guard = useRef(false),
    alert = useRef<HTMLParagraphElement>(null);
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      sequence.current++;
    },
    [],
  );
  useEffect(() => {
    if (error) alert.current?.focus();
  }, [error]);
  const load = useCallback(
    async (search: string, cursor: string | undefined, position: number) => {
      const current = ++sequence.current;
      setLoading(true);
      setPickerError("");
      try {
        const result = await searchCampaignTargetsAction(
          workspace,
          search,
          cursor,
        );
        if (current !== sequence.current) return;
        if (result.error) setPickerError(result.error);
        else if (result.value) {
          setPage((previous) => ({
            ...result.value,
            total: result.value.total ?? previous.total,
          }));
          setIndex(position);
          setCursors((previous) => [...previous.slice(0, position), cursor]);
        }
      } catch {
        if (current === sequence.current) setPickerError("failed");
      } finally {
        if (current === sequence.current) setLoading(false);
      }
    },
    [workspace],
  );
  const search = useCallback(
    (value: string) => {
      const next = value.slice(0, 200);
      if (next === query.current) return;
      query.current = next;
      sequence.current++;
      clearTimeout(timer.current);
      setLoading(true);
      setPickerError("");
      setPage({ items: [], total: 0, nextCursor: null });
      setIndex(0);
      setCursors([undefined]);
      timer.current = setTimeout(() => void load(next, undefined, 0), 250);
    },
    [load],
  );
  const items =
    choice && !page.items.some((item) => item.id === choice.id)
      ? [choice, ...page.items]
      : page.items;
  const errorKey = (code: string) =>
    code === "forbidden" ||
    code === "feature_required" ||
    code === "not_found" ||
    code === "invalid_input"
      ? code
      : "failed";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (guard.current) return;
    if (!choice || !confirmed) {
      setError("invalid_input");
      return;
    }
    guard.current = true;
    setPending(true);
    setError("");
    try {
      const result = await moveLinksToCampaignAction(
        workspace,
        selectionRef,
        choice.id,
      );
      if (result.error) setError(result.error);
      else if (result.value) {
        const key = `shortn:bulk-selection:/${workspace}/links/delete`;
        try {
          sessionStorage.setItem(key, "[]");
          window.dispatchEvent(
            new CustomEvent("shortn:bulk-selection", { detail: key }),
          );
        } catch {
          /* Saved operation does not depend on browser selection storage. */
        }
        setSuccess(result.value);
      }
    } catch {
      setError("failed");
    } finally {
      guard.current = false;
      setPending(false);
    }
  }
  if (success)
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className="text-small">
          {t("success", {
            selected: success.selected,
            updated: success.updated,
          })}
        </p>
        <p className="break-words text-small font-medium">
          {success.campaign.title}
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/${workspace}/campaigns/${success.campaign.id}`}
            className={buttonVariants({ variant: "primary", size: "md" })}
          >
            {t("open")}
          </Link>
          <Link
            href={`/${workspace}/links`}
            className={buttonVariants({ variant: "secondary", size: "md" })}
          >
            {t("back")}
          </Link>
        </div>
      </div>
    );
  return (
    <form onSubmit={submit} className="flex min-w-0 flex-col gap-5">
      <p className="text-small text-fg-muted">{t("effect", { count })}</p>
      <div className="min-w-0">
        <label
          htmlFor="campaign-target"
          className="mb-2 block text-small font-medium"
        >
          {t("campaign")}
        </label>
        <Combobox
          id="campaign-target"
          options={items.map((item) => ({
            value: item.id,
            label: item.title,
            meta:
              choice?.id === item.id &&
              !page.items.some((row) => row.id === item.id)
                ? t("current")
                : t("links", { count: item.linkCount }),
          }))}
          value={choice ? [choice.id] : []}
          onValueChange={(values) => {
            const item = items.find((item) => item.id === values[0]);
            if (item) {
              setChoice(item);
              setConfirmed(false);
              setError("");
            }
          }}
          onSearchChange={search}
          disabled={pending}
          placeholder={t("choose")}
          searchPlaceholder={t("search")}
          emptyText={t(loading ? "loading" : "empty")}
          footer={
            <div className="flex flex-wrap items-center gap-2 border-t border-line p-2">
              <p role="status" className="w-full text-meta text-fg-muted">
                {loading
                  ? t("loading")
                  : t("matches", {
                      count: page.items.length,
                      total: page.total ?? page.items.length,
                      page: index + 1,
                    })}
              </p>
              {pickerError ? (
                <p role="status" className="w-full text-meta text-danger">
                  {t(`errors.${errorKey(pickerError)}`)}
                </p>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={loading || index === 0}
                onClick={() =>
                  void load(query.current, cursors[index - 1], index - 1)
                }
              >
                {t("previous")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={loading || !page.nextCursor}
                onClick={() =>
                  void load(
                    query.current,
                    page.nextCursor ?? undefined,
                    index + 1,
                  )
                }
              >
                {t("next")}
              </Button>
              {pickerError ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    void load(query.current, cursors[index], index)
                  }
                >
                  {t("retry")}
                </Button>
              ) : null}
            </div>
          }
        />
        <p className="mt-2 text-meta text-fg-muted">{t("pickerHelp")}</p>
      </div>
      {choice ? (
        <p className="break-words text-small font-medium">
          {t("chosen", { name: choice.title })}
        </p>
      ) : null}
      <label className="flex items-start gap-2 text-small">
        <input
          type="checkbox"
          disabled={pending || !choice}
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
        />
        {t("confirm", { count })}
      </label>
      {error ? (
        <p
          ref={alert}
          role="alert"
          tabIndex={-1}
          className="text-small text-danger"
        >
          {t(`errors.${errorKey(error)}`)}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button
          type="submit"
          variant="primary"
          loading={pending}
          disabled={pending || !choice || !confirmed}
        >
          {t("apply")}
        </Button>
        <Link
          href={`/${workspace}/links`}
          className={buttonVariants({ variant: "secondary", size: "md" })}
        >
          {t("cancel")}
        </Link>
      </div>
    </form>
  );
}
