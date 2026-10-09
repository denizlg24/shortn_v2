import { resolveDuplicateCodes } from "./m0001-resolve-duplicate-codes";
import { workspaces } from "./m0002-workspaces";
import { linkDomainKey } from "./m0003-link-domain-key";
import { qrLinkRef } from "./m0004-qr-link-ref";
import { normalizeTags } from "./m0005-normalize-tags";
import { normalizeCampaignsUtm } from "./m0006-normalize-campaigns-utm";
import { clickEventsBackfill } from "./m0007-click-events-backfill";
import { bioPagesV2 } from "./m0008-bio-pages-v2";
import { linkPasswordSecrets } from "./m0009-link-password-secrets";
import { usagePeriods } from "./m0010-usage-periods";
import { subscriptionsMirror } from "./m0011-subscriptions-mirror";
import { assetsToStorage } from "./m0012-assets-to-storage";
import type { Migration } from "./runner";

// Applied in id order. Test fixtures are never registered here.
export const productionMigrations: Migration[] = [
  resolveDuplicateCodes,
  workspaces,
  linkDomainKey,
  qrLinkRef,
  normalizeTags,
  normalizeCampaignsUtm,
  clickEventsBackfill,
  bioPagesV2,
  linkPasswordSecrets,
  usagePeriods,
  subscriptionsMirror,
  assetsToStorage,
];
