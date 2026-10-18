import { ImageResponse } from "next/og";
import { loadPublicBio } from "@/server/public-bio";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default async function Image({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const bio = await loadPublicBio((await params).handle);
  const profile = bio.content.blocks.find((b) => b.type === "profile");
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: 80,
        background: bio.content.theme.background,
        color: bio.content.theme.text,
        fontSize: 64,
        fontWeight: 600,
      }}
    >
      <div style={{ display: "flex", fontSize: 32, marginBottom: 32 }}>
        {bio.handle}
      </div>
      <div style={{ display: "flex" }}>{profile?.title || bio.handle}</div>
      <div style={{ display: "flex", fontSize: 28, marginTop: 28 }}>
        {profile?.description?.slice(0, 240)}
      </div>
    </div>,
    size,
  );
}
