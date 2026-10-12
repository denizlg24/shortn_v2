import QRCode from "qrcode";
import { loadPublicBio } from "@/server/public-bio";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ handle: string; blockId: string }> },
) {
  const { handle, blockId } = await params,
    bio = await loadPublicBio(handle);
  const block = bio.content.blocks.find(
    (b) => b.id === blockId && b.type === "qr",
  );
  if (block?.type !== "qr" || !bio.links[block.linkId])
    return new Response("Not found", { status: 404 });
  const url = new URL(bio.links[block.linkId]!.href);
  url.searchParams.set("block", block.id);
  const svg = await QRCode.toString(url.href, {
    type: "svg",
    margin: 2,
    errorCorrectionLevel: "M",
  });
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=60",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
