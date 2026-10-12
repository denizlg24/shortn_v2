import type { CSSProperties, ReactNode } from "react";
import {
  accessibleBioTheme,
  readableBioColor,
  safeBioUrl,
  visibleBioBlock,
  type BioBlock,
  type BioContent,
  type BioResolvedLink,
} from "@shortn/core/bio-content";
import { SocialIcon } from "../social-icons";
import { BioEmbed } from "./embed";
import "./bio.css";
import { BioLinkButton, PaginatedBioLinks } from "./link-collection";

function InlineText({ text }: { text: string }) {
  const parts = text.split(
    /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g,
  );
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*"))
      return <em key={i}>{part.slice(1, -1)}</em>;
    const link = /^\[([^\]]+)\]\((.+)\)$/.exec(part);
    if (link && safeBioUrl(link[2]!))
      return (
        <a key={i} href={safeBioUrl(link[2]!)} rel="noopener noreferrer ugc">
          {link[1]}
        </a>
      );
    return part;
  });
}
export function BioRenderer({
  content,
  links,
  now = 0,
  preview = false,
  labels,
  renderSection,
}: {
  content: BioContent;
  links: Record<string, BioResolvedLink>;
  now?: number;
  preview?: boolean;
  renderSection?: (block: BioBlock, children: ReactNode) => ReactNode;
  labels: {
    branding: string;
    loadEmbed: string;
    embedConsent: string;
    unavailable: string;
  };
}) {
  const theme = accessibleBioTheme(content.theme);
  const legacyFont = theme.legacyFont;
  const style = {
    "--bio-bg": theme.background,
    "--bio-surface": theme.surface,
    "--bio-text": theme.text,
    "--bio-surface-text": readableBioColor(theme.text, theme.surface),
    "--bio-accent": theme.accent,
    "--bio-button-text": readableBioColor(theme.text, theme.accent),
    "--bio-radius": `${theme.radius}px`,
    fontFamily: `"${legacyFont ?? theme.font}", sans-serif`,
  } as CSSProperties;
  function render(block: BioBlock): ReactNode {
    switch (block.type) {
      case "profile":
        return (
          <header
            className="bio-profile"
            style={{
              textAlign: block.align,
              alignItems:
                block.align === "left"
                  ? "flex-start"
                  : block.align === "right"
                    ? "flex-end"
                    : "center",
            }}
          >
            {safeBioUrl(block.avatar) ? (
              <img
                className="bio-avatar"
                style={{
                  borderRadius:
                    block.avatarShape === "circle"
                      ? "50%"
                      : block.avatarShape === "rounded"
                        ? 12
                        : 0,
                }}
                src={safeBioUrl(block.avatar)}
                alt=""
                width={88}
                height={88}
              />
            ) : null}
            <h1>
              {block.title}
              {block.paidBadge ? (
                <span
                  className="ml-2 inline-block align-middle text-xs"
                  aria-label={
                    content.locale === "pt"
                      ? "Perfil pago"
                      : content.locale === "es"
                        ? "Perfil de pago"
                        : "Paid profile"
                  }
                >
                  ✦
                </span>
              ) : null}
            </h1>
            {block.description ? <p>{block.description}</p> : null}
          </header>
        );
      case "link":
        return (
          <BioLinkButton
            item={block}
            resolved={links[block.linkId]}
            preview={preview}
          />
        );
      case "links": {
        const items = block.items.filter(
          (item) =>
            (preview ? item.visible : visibleBioBlock(item, now)) &&
            links[item.linkId],
        );
        return (
          <section>
            {block.showLinkCount ? (
              <p className="bio-collection-count">
                {items.length} {content.locale === "es" ? "enlaces" : "links"}
              </p>
            ) : null}
            {block.title ? (
              <h2 className="bio-heading">{block.title}</h2>
            ) : null}
            {block.layout === "paginated" ? (
              <PaginatedBioLinks
                items={items}
                links={links}
                pageSize={block.pageSize}
                linkSurface={block.linkSurface}
                linkBorder={block.linkBorder}
                linkWeight={block.linkWeight}
                linkSpacing={block.linkSpacing}
                showLinkArrow={block.showLinkArrow}
                cardStyle={block.cardStyle}
                cardContent={
                  block.cardStyle === "list" ? "image-text" : block.cardContent
                }
                cardRadius={block.cardRadius}
                imageFit={block.imageFit}
                paginationAppearance={block.paginationAppearance}
                paginationSize={block.paginationSize}
                paginationStyle={block.paginationStyle}
                showPageCount={block.showPageCount}
                preview={preview}
                locale={content.locale}
              />
            ) : (
              <div
                className="bio-link-list"
                data-layout={block.cardStyle}
                data-spacing={block.linkSpacing}
              >
                {items.map((item) => (
                  <BioLinkButton
                    key={item.id}
                    item={item}
                    resolved={links[item.linkId]}
                    preview={preview}
                    linkSurface={block.linkSurface}
                    linkBorder={block.linkBorder}
                    linkWeight={block.linkWeight}
                    linkSpacing={block.linkSpacing}
                    showLinkArrow={block.showLinkArrow}
                    cardStyle={block.cardStyle}
                    cardContent={
                      block.cardStyle === "list"
                        ? "image-text"
                        : block.cardContent
                    }
                    cardRadius={block.cardRadius}
                    imageFit={block.imageFit}
                  />
                ))}
              </div>
            )}
          </section>
        );
      }
      case "socials":
        return (
          <nav className="bio-socials" aria-label="Social links">
            {block.items.map((item, i) =>
              safeBioUrl(item.url) ? (
                <a
                  key={`${item.platform}-${i}`}
                  href={preview ? undefined : safeBioUrl(item.url)}
                  aria-label={item.platform}
                  rel="ugc noopener noreferrer"
                >
                  <SocialIcon platform={item.platform} color="currentColor" />
                </a>
              ) : null,
            )}
          </nav>
        );
      case "header":
        return <h2 className="bio-heading">{block.text}</h2>;
      case "text":
        return (
          <p className="bio-text">
            <InlineText text={block.text} />
          </p>
        );
      case "image": {
        const image = safeBioUrl(block.url);
        if (!image) return null;
        const img = (
          <img
            className="bio-image"
            src={image}
            alt={block.alt}
            loading="lazy"
          />
        );
        return safeBioUrl(block.link ?? "") ? (
          <a
            href={preview ? undefined : safeBioUrl(block.link!)}
            rel="ugc noopener noreferrer"
          >
            {img}
          </a>
        ) : (
          img
        );
      }
      case "embed":
        return (
          <BioEmbed
            provider={block.provider}
            url={block.url}
            preview={preview}
            loadLabel={labels.loadEmbed}
            consentLabel={labels.embedConsent}
          />
        );
      case "qr": {
        const resolved = links[block.linkId];
        if (!resolved?.qrImage) return null;
        return (
          <figure className="bio-qr">
            <a href={preview ? undefined : resolved.href}>
              <img
                src={resolved.qrImage}
                alt={block.title || resolved.title}
                width={192}
                height={192}
                loading="lazy"
              />
            </a>
            {block.title ? <figcaption>{block.title}</figcaption> : null}
          </figure>
        );
      }
    }
  }
  return (
    <article
      className="bio-page"
      data-density={theme.density}
      data-button-style={theme.buttonStyle}
      style={style}
    >
      {legacyFont ? (
        <link
          rel="stylesheet"
          href={`https://fonts.googleapis.com/css2?family=${encodeURIComponent(legacyFont)}:wght@400;600&display=swap`}
        />
      ) : null}
      {theme.backgroundImage ? (
        <div
          className="bio-cover"
          style={{
            backgroundImage: `url(${JSON.stringify(theme.backgroundImage)})`,
          }}
          aria-hidden="true"
        />
      ) : null}
      <div className="bio-content">
        {content.blocks
          .filter(
            (block) =>
              renderSection ||
              (preview ? block.visible : visibleBioBlock(block, now)),
          )
          .map((block) => (
            <div className="bio-block" key={block.id}>
              {renderSection
                ? renderSection(block, render(block))
                : render(block)}
            </div>
          ))}
        {!content.hideBranding ? (
          <footer className="bio-footer">
            <a href={preview ? undefined : "https://shortn.at"}>
              {labels.branding}
            </a>
          </footer>
        ) : null}
      </div>
    </article>
  );
}
