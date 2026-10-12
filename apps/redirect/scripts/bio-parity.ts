import { getDb, closeMongoClient, physicalNames } from "@shortn/db";
import { resolveLegacyBio } from "@shortn/core";
import { bioCanonical } from "@shortn/core/bio-hosts";
// Read only. Exhaustive over the source data, rather than a ranked sample.
const url = process.env.MONGO_TEST_URL ?? process.env.MONGODB_URL;
const name = process.env.MONGODB_DB;
if (!url || !name) throw new Error("MONGODB_URL and MONGODB_DB are required");
const origin = process.env.PUBLIC_ORIGIN ?? "https://shortn.at";
try {
  const db = await getDb({ url, database: name });
  const pages = await db
    .collection(physicalNames.bio_pages)
    .find({ $or: [{ publicationManaged: { $ne: true } }, { published: true }] })
    .toArray();
  const aliases = await db
    .collection(physicalNames.bio_aliases)
    .find({})
    .toArray();
  const expected = new Map<string, string>();
  for (const page of pages)
    for (const slug of [page.slug, page.legacySlug])
      if (typeof slug === "string") expected.set(slug, String(page._id));
  for (const alias of aliases)
    expected.set(String(alias.slug), String(alias.bioPageId));
  const mismatches: string[] = [];
  for (const [slug, id] of expected) {
    const page = await resolveLegacyBio(db, slug);
    if (!page || String(page._id) !== id) {
      mismatches.push(slug);
      continue;
    }
    const target = bioCanonical(
      String(page.handle),
      origin,
      process.env.BIO_SUBDOMAINS === "1",
    );
    if (process.env.BIO_PARITY_ORIGIN) {
      for (const suffix of ["", "/"]) {
        const response = await fetch(
          new URL(
            `/b/${encodeURIComponent(slug)}${suffix}`,
            process.env.BIO_PARITY_ORIGIN,
          ),
          { redirect: "manual" },
        );
        if (
          response.status !== 301 ||
          response.headers.get("location") !== target
        )
          mismatches.push(`${slug}${suffix}: ${response.status}`);
      }
    }
  }
  console.log(
    JSON.stringify(
      {
        slugs: expected.size,
        matched:
          expected.size - new Set(mismatches.map((s) => s.split(":")[0])).size,
        mismatches,
      },
      null,
      2,
    ),
  );
  if (mismatches.length) process.exitCode = 1;
} finally {
  await closeMongoClient();
}
