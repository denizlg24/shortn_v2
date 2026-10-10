import { cache } from "react";
import { getCampaignAction } from "@/server/actions/campaigns";

// Metadata and the page read the same campaign within one request.
export const loadCampaign = cache(getCampaignAction);
