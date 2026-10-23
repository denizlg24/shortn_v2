"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Button, buttonVariants } from "@shortn/ui";
import { FormField, inputClass } from "../page/form";
import { ImageUpload, useUploadStatus } from "../page/image-upload";
import { normalizeSelection } from "@/lib/bulk-selection";
import {
  addBioDestinationAction,
  bioDestinationsAction,
  bioDestinationSectionsAction,
} from "@/server/actions/bio-link-destination";

export function BioLinkDestination({
  workspace,
  ids,
}: {
  workspace: string;
  ids: string[];
}) {
  const t = useTranslations("bio.destination");
  const [search, setSearch] = useState("");
  const [cursor, setCursor] = useState<string>();
  const [pages, setPages] = useState<Awaited<
    ReturnType<typeof bioDestinationsAction>
  > | null>(null);
  const [pageId, setPageId] = useState("");
  const [pageTitle, setPageTitle] = useState("");
  const [sections, setSections] = useState<Awaited<
    ReturnType<typeof bioDestinationSectionsAction>
  > | null>(null);
  const [sectionId, setSectionId] = useState("");
  const [sectionTitle, setSectionTitle] = useState("");
  const [image, setImage] = useState("");
  const uploads = useUploadStatus();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [success, setSuccess] = useState<{
    added: number;
    skipped: number;
    sectionId: string;
  } | null>(null);
  useEffect(() => {
    let live = true;
    const timer = setTimeout(() => {
      void bioDestinationsAction(workspace, search, cursor)
        .then((result) => {
          if (live) {
            setPages(result);
            setLoading(false);
          }
        })
        .catch(() => {
          if (live) {
            setError("loadFailed");
            setLoading(false);
          }
        });
    }, 200);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [workspace, search, cursor, retry]);
  useEffect(() => {
    if (!pageId) return;
    let live = true;
    void bioDestinationSectionsAction(workspace, pageId)
      .then((result) => {
        if (live) {
          setSections(result);
          setSectionId(result.sections[0]?.id ?? "");
        }
      })
      .catch(() => {
        if (live) setError("loadFailed");
      });
    return () => {
      live = false;
    };
  }, [workspace, pageId, retry]);
  async function submit() {
    if (!sections || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await addBioDestinationAction(workspace, pageId, {
        ids,
        revision: sections.revision,
        ...(sectionId ? { sectionId } : {}),
        sectionTitle,
        ...(image && ids.length === 1 ? { image } : {}),
      });
      if (result.ok) {
        setSuccess(result.value);
        // Keep unrelated links selected when this flow started from a single row.
        try {
          const key = `shortn:bulk-selection:/${workspace}/links/delete`;
          const applied = new Set(ids);
          const remaining = normalizeSelection(
            JSON.parse(sessionStorage.getItem(key) ?? "[]"),
          ).filter((id) => !applied.has(id));
          sessionStorage.setItem(key, JSON.stringify(remaining));
          window.dispatchEvent(
            new CustomEvent("shortn:bulk-selection", { detail: key }),
          );
        } catch {
          /* Storage may be unavailable. */
        }
      } else setError(result.error);
    } catch {
      setError("generic");
    } finally {
      setBusy(false);
    }
  }
  if (success)
    return (
      <div className="grid gap-4" role="status">
        <p className="text-body font-medium">
          {t("success", { count: success.added })}
        </p>
        {success.skipped ? (
          <p className="text-small text-fg-muted">
            {t("skipped", { count: success.skipped })}
          </p>
        ) : null}
        <p className="text-small text-fg-muted">{t("draftHint")}</p>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/${workspace}/bio/${pageId}/editor?section=${encodeURIComponent(success.sectionId)}`}
            className={buttonVariants({ variant: "primary", size: "md" })}
          >
            {t("reviewPublish")}
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
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      className="grid gap-5"
    >
      <p className="text-small text-fg-muted">
        {t("selection", { count: ids.length })}
      </p>
      {!pageId ? (
        <>
          <FormField id="bio-page-search" label={t("searchPages")}>
            <input
              id="bio-page-search"
              type="search"
              value={search}
              maxLength={200}
              className={inputClass}
              onChange={(event) => {
                setSearch(event.target.value);
                setCursor(undefined);
                setPages(null);
                setLoading(true);
                setError("");
              }}
            />
          </FormField>
          {loading ? (
            <p role="status" className="text-small text-fg-muted">
              {t("loading")}
            </p>
          ) : pages?.items.length ? (
            <ul className="divide-y divide-line border-y border-line">
              {pages.items.map((page) => (
                <li key={page.id}>
                  <button
                    type="button"
                    className="flex min-h-16 w-full min-w-0 items-center justify-between gap-4 px-2 py-3 text-left hover:bg-bg-subtle"
                    onClick={() => {
                      setPageId(page.id);
                      setPageTitle(page.title || page.slug);
                      setSections(null);
                      setError("");
                    }}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-small font-medium">
                        {page.title || page.slug}
                      </span>
                      <span className="block truncate text-meta text-fg-muted">
                        {page.slug}
                      </span>
                    </span>
                    <span className="shrink-0 text-meta text-fg-muted">
                      {t("linkCount", { count: page.linkCount })}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-small text-fg-muted">
              {t(search ? "noResults" : "noPages")}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {cursor ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setCursor(undefined);
                  setLoading(true);
                }}
              >
                {t("firstPage")}
              </Button>
            ) : null}
            {pages?.nextCursor ? (
              <Button
                type="button"
                variant="secondary"
                disabled={loading}
                onClick={() => {
                  setCursor(pages.nextCursor!);
                  setLoading(true);
                }}
              >
                {t("next")}
              </Button>
            ) : null}
            <Link
              href={`/${workspace}/bio/new`}
              className={buttonVariants({ variant: "ghost", size: "md" })}
            >
              {t("createPage")}
            </Link>
          </div>
        </>
      ) : (
        <>
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
            <span className="min-w-0 break-words text-small font-medium">
              {pageTitle}
            </span>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setPageId("");
                setSections(null);
                setError("");
              }}
            >
              {t("changePage")}
            </Button>
          </div>
          {sections ? (
            <fieldset disabled={busy} className="grid gap-4">
              <FormField
                id="bio-section"
                label={t("section")}
                hint={t("sectionHint")}
              >
                <select
                  id="bio-section"
                  value={sectionId}
                  onChange={(event) => setSectionId(event.target.value)}
                  className={inputClass}
                  aria-describedby="bio-section-hint"
                >
                  {sections.sections.map((section, index) => (
                    <option key={section.id} value={section.id}>
                      {t("sectionOption", {
                        title:
                          section.title || t("untitled", { number: index + 1 }),
                        count: section.count,
                      })}
                      {section.visible ? "" : ` · ${t("hidden")}`}
                    </option>
                  ))}
                  <option value="">{t("newSection")}</option>
                </select>
              </FormField>
              {!sectionId ? (
                <FormField id="bio-section-title" label={t("sectionTitle")}>
                  <input
                    id="bio-section-title"
                    className={inputClass}
                    value={sectionTitle}
                    maxLength={120}
                    required
                    onChange={(event) => setSectionTitle(event.target.value)}
                  />
                </FormField>
              ) : null}
              {ids.length === 1 ? (
                <FormField
                  id="bio-link-image"
                  label={t("image")}
                  hint={t("imageHint")}
                  optional={t("optional")}
                >
                  <ImageUpload
                    id="bio-link-image"
                    label={t("image")}
                    value={image}
                    onChange={setImage}
                    onBusyChange={uploads.onBusyChange}
                  />
                </FormField>
              ) : null}
              <p className="text-meta text-fg-muted">{t("limits")}</p>
              <Button
                type="submit"
                variant="primary"
                className="justify-self-start"
                disabled={
                  busy ||
                  uploads.uploading ||
                  (!sectionId && !sectionTitle.trim())
                }
              >
                {t(busy ? "adding" : "submit", { count: ids.length })}
              </Button>
            </fieldset>
          ) : (
            <p role="status" className="text-small text-fg-muted">
              {t("loading")}
            </p>
          )}
        </>
      )}
      {error ? (
        <div role="alert" className="grid gap-2 text-small">
          <p className="text-danger">
            {t(
              `errors.${["forbidden", "not_found", "conflict", "section_not_found", "link_not_found", "limit_reached", "loadFailed"].includes(error) ? error : "generic"}` as "errors.generic",
            )}
          </p>
          <Button
            type="button"
            variant="secondary"
            className="justify-self-start"
            disabled={busy}
            onClick={() => {
              setError("");
              setLoading(true);
              setRetry((value) => value + 1);
            }}
          >
            {t("reload")}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
