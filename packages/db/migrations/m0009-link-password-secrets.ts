import { names, report } from "./helpers";
import type { Migration } from "./runner";

// No schema change: legacy /authenticate stays the only password verifier
// until P4, and apps/redirect accepts both AUTH_SECRET and LINK_ACCESS_SECRET
// cookies. This checks that 0003 mirrored every hash the redirect relies on.
export const linkPasswordSecrets: Migration = {
  id: "0009-link-password-secrets",
  phase: "expand",
  async up() {},
  async verify(ctx) {
    const links = ctx.read(names.links);
    const protectedLinks = await links.countDocuments({
      passwordProtected: true,
    });
    const withoutHash = await links.countDocuments({
      passwordProtected: true,
      passwordHash: { $not: { $type: "string" } },
    });
    const unmirrored = await links.countDocuments({
      passwordProtected: true,
      passwordHash: { $type: "string" },
      $expr: { $ne: ["$password.hash", "$passwordHash"] },
    });
    return report(
      { protectedLinks, withoutHash, unmirrored },
      unmirrored
        ? [`${unmirrored} protected links lack a mirrored password.hash`]
        : [],
    );
  },
  async down() {},
};
