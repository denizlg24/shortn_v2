// Plain constants, so the server page can read them.
export const campaignTabs = ["analytics", "links", "builder"] as const;
export type CampaignTab = (typeof campaignTabs)[number];
