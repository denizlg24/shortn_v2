# Organizing campaigns

A campaign groups the UTM-tagged variants of your links so you can read their clicks together. Its title is the `utm_campaign` value, it stores suggested values for the other UTM parameters, and its UTM builder tags many links in one step. Campaigns depend on your plan; if yours doesn't include them, the Campaigns page says which plan does.

## Create a campaign

1. Open **Campaigns** in the sidebar and select **New campaign**.
2. Enter a **Title**. It is used as `utm_campaign` in the URLs you tag, so write it the way it should read in your analytics, for example `spring-sale`.
3. Optionally add a **Description**.
4. Select **Create campaign**.

The campaign opens with the tabs **Overview**, **Analytics**, **UTM builder** and **Settings**.

## Set UTM defaults

Open **Settings** and fill in the **UTM defaults**: lists of suggested sources, mediums, terms and contents. Type a value and press Enter to add it. Values are saved in lowercase. The UTM builder and the link variant form suggest them, which keeps spelling consistent across your team.

Renaming the campaign switches saved variants to the new title. URLs you have already shared keep the old title, and their clicks stop counting in the campaign.

## Add links with the UTM builder

1. Open **UTM builder**, or select **Build a tagged URL** on the overview.
2. Under **Links**, select **Browse links**. Filter by tags, search, or group results by tag. Tick links on as many pages as you need, or use **Select all results**, then select **Use … selected links**.
3. Fill in **Source**, **Medium** and, optionally, **Term** and **Content**. `utm_campaign` is always the campaign's title.
4. Check the **Tagged URL** preview and select **Copy URL** if you need it straight away.
5. Select **Save as variant**. With several links selected, the button saves the same variant on every one.

A link joins the campaign when one of its UTM variants uses the campaign. Until you save the variant, its clicks don't count in the campaign.

You can also add variants one link at a time from the link's **UTM variants** tab; see [UTM parameters](/docs/en/guides/links/utm-parameters).

## Move existing links into a campaign

From **Links**, select the links you want, across pages and filters, and choose **Move to campaign**. Pick the **Destination campaign** and select **Move selected links**. Each UTM variant keeps its source, medium, term and content, and the campaign's defaults don't overwrite them.

## Read campaign results

The **Overview** shows the last 30 days of clicks, scans and visitors, and **Links and variants** lists each link with its tagged URLs and clicks. Select **Copy utm_campaign** to copy the exact value.

The **Analytics** tab opens the full analytics filtered to the campaign, with the same date ranges, breakdowns and filters as the workspace **Analytics** page. Exporting a campaign's analytics as CSV depends on your plan. See [Understanding analytics](/docs/en/guides/analytics/understanding-analytics).

## Find campaigns

The Campaigns list has a **Search** field for titles and descriptions, and **Sort by** options for newest, oldest, most links or title.

## Delete a campaign

On the overview, select **Delete campaign** and confirm. Its UTM variants are removed from the links, and its UTM defaults are deleted. The links themselves keep working. URLs already shared with its `utm_campaign` keep their clicks, but no campaign page shows them any more.

## Tips

- Agree on a naming scheme for titles, such as `season-year-product`, before the team starts tagging.
- Use `utm_content` to compare placements of the same link inside one channel.

## Next steps

- [UTM parameters](/docs/en/guides/links/utm-parameters)
- [Understanding analytics](/docs/en/guides/analytics/understanding-analytics)
