import { cn } from "@shortn/ui";
import type { StaticImageData } from "next/image";
import { getTranslations } from "next-intl/server";
import { shots, type ShotName } from "./shots";

/**
 * A real dashboard capture (20 §2: real product screenshots only), with the
 * theme the visitor reads in. Static imports keep them on the asset origin.
 */
export async function ProductShot({
  name,
  alt,
  className,
  priority = false,
  caption = false,
}: {
  name: ShotName;
  alt: string;
  className?: string;
  priority?: boolean;
  /** The sample-data note; once per page is enough. */
  caption?: boolean;
}) {
  const shot = shots[name];
  const t = await getTranslations("marketing.shots");
  return (
    <figure className={cn("flex flex-col gap-2", className)}>
      <div className="overflow-hidden rounded-overlay border border-line bg-bg-subtle">
        <Capture
          image={shot.light}
          alt={alt}
          priority={priority}
          className="dark:hidden"
        />
        <Capture
          image={shot.dark}
          alt={alt}
          priority={priority}
          className="hidden dark:block"
        />
      </div>
      {caption ? (
        <figcaption className="text-meta text-fg-subtle">
          {t("sample")}
        </figcaption>
      ) : null}
    </figure>
  );
}

function Capture({
  image,
  alt,
  priority,
  className,
}: {
  image: StaticImageData;
  alt: string;
  priority: boolean;
  className: string;
}) {
  return (
    // Plain <img>: /_next/image is not routed on the root host until P7.
    <img
      src={image.src}
      width={image.width}
      height={image.height}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      className={cn("block h-auto w-full", className)}
    />
  );
}
