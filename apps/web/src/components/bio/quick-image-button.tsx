"use client";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ImagePlus, LoaderCircle } from "lucide-react";
import { uploadImage } from "../page/image-upload";

/** One click from a link row to a file picker; the upload sets the link image. */
export function QuickImageButton({
  workspace,
  title,
  image,
  className,
  disabled,
  onUploaded,
  onError,
  onBusyChange,
}: {
  workspace: string;
  title: string;
  image: string;
  className: string;
  disabled?: boolean;
  onUploaded: (url: string) => void;
  onError: (message: string) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const t = useTranslations("bio.editor");
  const tUpload = useTranslations("common.imageUpload");
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const label = image ? t("replaceImage", { title }) : t("addImage", { title });
  async function upload(file: File) {
    setPending(true);
    onBusyChange(true);
    try {
      const result = await uploadImage(workspace, file, "bio-image");
      if (result.ok) onUploaded(result.url);
      else onError(tUpload(result.error));
    } finally {
      setPending(false);
      onBusyChange(false);
    }
  }
  return (
    <>
      <input
        ref={input}
        type="file"
        tabIndex={-1}
        aria-hidden
        className="sr-only"
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void upload(file);
        }}
      />
      <button
        type="button"
        className={className}
        aria-label={label}
        title={label}
        disabled={disabled || pending}
        aria-busy={pending || undefined}
        onClick={() => input.current?.click()}
      >
        {pending ? (
          <LoaderCircle
            aria-hidden
            className="size-4 motion-safe:animate-spin"
          />
        ) : image ? (
          <img src={image} alt="" className="size-5 rounded-sm object-cover" />
        ) : (
          <ImagePlus aria-hidden className="size-4" />
        )}
      </button>
    </>
  );
}
