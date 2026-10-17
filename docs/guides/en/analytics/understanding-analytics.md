# Understanding analytics

Shortn counts every visit to your short links and QR codes. This guide explains what is counted, how to narrow the numbers down with ranges, breakdowns and filters, how to export them, and how visitor data is protected.

## Clicks and scans

Shortn records two kinds of visit:

- a **click** is a visit through a short link, whether typed, tapped or opened from another site;
- a **scan** is a visit through one of your QR codes.

The **Type** filter switches between **Clicks and scans**, **Clicks** and **QR scans**. The summary at the top also shows **Unique visitors** and the **Top country**.

## Where to find analytics

- **Analytics** in the sidebar covers the whole workspace.
- A link's **Analytics** tab covers that link.
- A QR code's **Scans** tab covers that code.
- A campaign's **Analytics** tab covers the links in that campaign.
- A bio page's **Analytics** tab shows views, clicks and the click-through rate of the page.

All of them except bio pages share the same controls.

## Choose a date range

1. Open **Date range** and pick **Last 7 days**, **Last 30 days**, **Last 90 days** or **Last 12 months**, or set a **Custom range** with **From** and **To** dates.
2. Choose an **Interval** to group the chart by hour, day, week or month.

How far back you can go depends on your plan's analytics history. When a range starts earlier, the page tells you the date before which data is outside your plan's analytics window and shows what it can. See [Pricing](/en/pricing) for the history each plan includes.

## Breakdowns

Below the chart, breakdowns group visits by:

- **Links**
- **Countries** and **Cities**
- **Referrers**: the site a visit came from. Direct means no referring site, such as a typed address, an app or a QR scan.
- **Devices**, **Browsers** and **Operating systems**
- **UTM sources**, **UTM mediums** and **UTM campaigns**
- **Routing branches**: which redirect rule picked the destination, for links with country, device or rotation rules.

Each breakdown shows the top rows; select **See all** for the full list. Breakdowns other than links, and filtering by them, depend on your plan.

## Filter the view

Select a value in a breakdown to filter the whole page by it, or open the filters to combine several, for example one link, one country and mobile devices. Select **Clear all** to remove them.

Every filter is part of the page address, so you can bookmark a view or share it with a colleague who has access to the workspace.

## Export analytics

1. Set the range and filters you want.
2. Select **Export analytics**.
3. Under **Data**, choose **Aggregates** for totals per time bucket and per group, or **Raw events** for one row per visit.
4. Choose the format (CSV, or NDJSON for raw events) and select **Prepare export**.

Exports run in the background, so you can leave the page. Find finished files under **Export history**. Files and history expire 24 hours after preparation. The export keeps the retained window you reviewed, even if your plan changes before it runs. CSV export depends on your plan, and campaign export has its own plan requirement.

## Privacy

- Visitor IP addresses are hashed.
- Raw IP addresses are deleted after 90 days.
- Raw-event exports exclude IP addresses, visitor hashes and user agents.
- Embedded content on bio pages loads only after the visitor chooses to load it.

## Reading the numbers

- Compare the same range across links, rather than totals across ranges of different length.
- Use UTM breakdowns to see which channel worked, and routing branches to compare the destinations of one link.

## Next steps

- [UTM parameters](/docs/en/guides/links/utm-parameters)
- [Organizing campaigns](/docs/en/guides/campaigns/organizing-campaigns)
- [Upgrading plans](/docs/en/guides/billing/upgrading-plans)
