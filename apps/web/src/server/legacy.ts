import "server-only";
import { env } from "./env";

// Legacy still renders /b/{slug} statically during coexistence (16 §4.5);
// it re-renders after edits made here. Best effort: the page refreshes on
// legacy's next deploy anyway.
export async function revalidateLegacyBio(slugs: string[]) {
  const { LEGACY_ORIGIN, LEGACY_INTERNAL_SECRET } = env();
  if (!LEGACY_ORIGIN || !LEGACY_INTERNAL_SECRET || !slugs.length) return;
  try {
    await fetch(new URL("/api/internal/revalidate-bio", LEGACY_ORIGIN), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-secret": LEGACY_INTERNAL_SECRET,
      },
      body: JSON.stringify({ slugs }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (error) {
    console.error("legacy bio revalidation failed", slugs, error);
  }
}
