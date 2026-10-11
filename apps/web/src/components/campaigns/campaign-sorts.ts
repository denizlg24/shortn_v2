// Plain data, so the server page can read it next to the client filter bar.
export const campaignSorts = ["newest", "oldest", "links", "title"] as const;
export type CampaignSort = (typeof campaignSorts)[number];

export const isCampaignSort = (value: unknown): value is CampaignSort =>
  campaignSorts.some((sort) => sort === value);
