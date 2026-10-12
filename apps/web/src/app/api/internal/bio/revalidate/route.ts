import { revalidateTag } from "next/cache";
import { env } from "@/server/env";
export async function POST(request: Request) {
  if (
    !env().BIO_INTERNAL_SECRET ||
    request.headers.get("authorization") !==
      `Bearer ${env().BIO_INTERNAL_SECRET}`
  )
    return new Response("Forbidden", { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.id !== "string" || !/^[a-f\d]{24}$/i.test(body.id))
    return new Response("Invalid input", { status: 400 });
  revalidateTag(`bio:${body.id}`, { expire: 0 });
  return Response.json({ ok: true });
}
