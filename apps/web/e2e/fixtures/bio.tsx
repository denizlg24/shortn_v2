import { bioPresets, type BioContent } from "@shortn/core/bio-content";
import { BioRenderer } from "../../src/components/bio/public/bio-renderer";
import "../../src/components/bio/public/fonts.css";
export default async function BioFixture({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const query = await searchParams,
    count = Number(query.count ?? 25),
    locale = query.locale ?? "en";
  const title =
    locale === "pt"
      ? "São João — edição especial de histórias, música e encontros"
      : locale === "es"
        ? "Una edición especial de historias, música y encuentros en España"
        : "A collection of stories, music and places worth sharing";
  const id = "123456789012345678901234";
  const content: BioContent = {
    locale: locale === "pt" || locale === "es" ? locale : "en",
    theme: bioPresets[query.theme ?? "paper"]!,
    seo: { title: "", description: "", noindex: true },
    hideBranding: false,
    blocks: [
      {
        id: "profile",
        type: "profile",
        visible: true,
        title,
        description:
          "Synthetic fixture — conteúdo de demonstração / contenido de prueba. Long descriptions stay readable and wrap naturally without covering any links.",
        avatar: "",
        avatarShape: "circle",
        align: "left",
      },
      ...Array.from({ length: count }, (_, at) => ({
        id: `link-${at}`,
        type: "link" as const,
        visible: true,
        linkId: id,
        title:
          at % 2
            ? `Edition ${at + 1} — São João, coração, acción, información, histórias para partilhar e encontros para recordar`
            : `Read edition ${at + 1}`,
        image: at % 3 === 0 ? "https://assets.example.test/thumb.svg" : "",
        highlight: at === 0,
      })),
      ...(query.embed
        ? [
            {
              id: "embed",
              visible: true,
              type: "embed" as const,
              provider: "youtube" as const,
              url: "https://youtu.be/dQw4w9WgXcQ",
            },
          ]
        : []),
    ],
  };
  return (
    <main style={{ minHeight: "100dvh" }}>
      <BioRenderer
        content={content}
        now={Date.UTC(2026, 9, 12)}
        links={{
          [id]: {
            href: "https://shortn.at/example?ref=bio:fixture",
            title: "Example",
          },
        }}
        labels={{
          branding: "Made with Shortn",
          loadEmbed: "Load {provider}",
          embedConsent: "Loading shares your IP address with {provider}.",
          unavailable: "Unavailable",
        }}
      />
    </main>
  );
}
