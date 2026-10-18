"use client";

import { Button } from "@shortn/ui";
import { ImageIcon, Upload, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { useShell } from "../shell/shell-context";

export function useUploadStatus() {
  const [count, setCount] = useState(0);
  const onBusyChange = useCallback(
    (busy: boolean) => setCount((count) => count + (busy ? 1 : -1)),
    [],
  );
  return { uploading: count > 0, onBusyChange };
}

/** Uploads a file immediately; the form saves its resulting image with the draft. */
export function ImageUpload({
  id,
  label,
  value,
  onChange,
  name,
  purpose = "bio-image",
  disabled = false,
  onBusyChange,
}: {
  id?: string | undefined;
  label: string;
  value: string;
  onChange: (url: string) => void;
  name?: string;
  purpose?: "qr-logo" | "bio-image" | "avatar";
  disabled?: boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  const t = useTranslations("common.imageUpload");
  const { workspace } = useShell();
  const input = useRef<HTMLInputElement>(null);
  const latestChange = useRef(onChange);
  const live = useRef(true);
  useEffect(() => {
    latestChange.current = onChange;
  }, [onChange]);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const run = async (file: File) => {
    setError(null);
    if (file.size > 5 * 1024 * 1024) {
      setError(t("size"));
      return;
    }
    setPending(true);
    onBusyChange(true);
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch(
        `/api/uploads/${encodeURIComponent(workspace.slug)}?purpose=${purpose}`,
        { method: "POST", body },
      );
      const result = await response.json();
      if (!response.ok || typeof result.url !== "string") {
        const key = [
          "size",
          "type",
          "forbidden",
          "unauthenticated",
          "plan",
          "unavailable",
        ].includes(result.error)
          ? result.error
          : "failed";
        setError(t(key));
      } else if (live.current) latestChange.current(result.url);
    } catch {
      setError(t("failed"));
    } finally {
      setPending(false);
      onBusyChange(false);
      if (input.current) input.current.value = "";
    }
  };
  return (
    <div
      className="flex min-w-0 flex-col gap-2"
      data-uploading={pending || undefined}
    >
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <input
        ref={input}
        id={id}
        type="file"
        tabIndex={-1}
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
        aria-label={label}
        className="sr-only"
        disabled={disabled || pending}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void run(file);
        }}
      />
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {value ? (
          <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-control border border-line bg-bg-subtle">
            {failedImage === value ? (
              <ImageIcon aria-hidden className="size-4 text-fg-muted" />
            ) : (
              <img
                src={value}
                alt=""
                className="size-full object-contain"
                onError={() => setFailedImage(value)}
              />
            )}
          </div>
        ) : null}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          loading={pending}
          disabled={disabled}
          onClick={() => input.current?.click()}
        >
          {pending ? null : <Upload aria-hidden />}
          {pending ? t("uploading") : value ? t("replace") : t("choose")}
        </Button>
        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || pending}
            onClick={() => {
              setError(null);
              onChange("");
            }}
          >
            <X aria-hidden />
            {t("remove")}
          </Button>
        ) : null}
      </div>
      <p className="text-meta text-fg-muted">{t("hint")}</p>
      {error ? (
        <p role="alert" className="text-small text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
