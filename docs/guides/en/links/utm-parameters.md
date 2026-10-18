# UTM parameters

UTM parameters are query tags such as `utm_source=newsletter` that analytics tools read to tell where a visit came from. Shortn handles them in three places: UTM variants on a link, the UTM builder in a campaign, and the redirect settings that decide which parameters reach the destination.

## The five parameters

- `utm_source`: where the traffic comes from, such as `newsletter` or `facebook`.
- `utm_medium`: the type of channel, such as `email` or `social`.
- `utm_campaign`: the campaign the visit belongs to.
- `utm_term`: a paid search keyword. Optional.
- `utm_content`: tells similar links apart, such as `header` and `footer`. Optional.

## Add UTM variants to a link

A variant is a tagged version of one short link for one channel. Visits through it are counted per source, medium and campaign.

1. Open the link and select the **UTM variants** tab.
2. Select **Add variant**.
3. Fill in **Source**, **Medium** and **Campaign**, and optionally **Term** and **Content**. Choosing a saved campaign shows its suggested values.
4. Select **Save variant**.

The variant list shows each **Tagged URL**: your short link with the parameters appended, for example `shortn.at/spring?utm_source=newsletter&utm_medium=email&utm_campaign=spring-sale`. Select **Copy** to copy it.

The **Campaign** value links the variant to the campaign with the same name, which adds the link to that campaign. UTM variants and campaigns depend on your plan.

To change a variant, select **Edit**. To delete it, select **Remove** and confirm with **Remove variant**. URLs you have already shared keep redirecting, and their analytics remain. If it was the link's last variant in a campaign, the link leaves that campaign.

## Tag many links at once

To tag several links for the same channel, use the **UTM builder** tab of a campaign. It always sets `utm_campaign` to the campaign's title, suggests your saved values, and saves the same variant on every link you select. See [Organizing campaigns](/docs/en/guides/campaigns/organizing-campaigns).

## Control what reaches the destination

The tagged URL carries the parameters to Shortn, which records them with each visit. Whether they are passed on to the destination depends on the link's redirect settings.

1. Open the link's **Edit** tab and expand **Advanced options**.
2. Open **Redirect and query parameters**.
3. Choose your settings:
   - **Forward incoming query parameters** passes the visitor's query parameters, including UTM tags, on to the destination.
   - The `utm_source`, `utm_medium`, `utm_campaign`, `utm_term` and `utm_content` fields set fixed values that are always added to the destination.
4. Select **Save changes**.

When the same parameter appears in more than one place, these rules apply:

- a fixed UTM value from the redirect settings always wins;
- otherwise a parameter already in the destination URL is kept over an incoming one;
- incoming parameters are forwarded only when forwarding is on.

## Read UTM results

On the **Analytics** page, the **UTM sources**, **UTM mediums** and **UTM campaigns** breakdowns group visits by tag, and you can filter by any value. Breakdowns depend on your plan. See [Understanding analytics](/docs/en/guides/analytics/understanding-analytics).

## Good practice

- Write values in lowercase and keep one spelling per channel, so results for the same channel aren't split across several values.
- Use `utm_content` to compare placements of the same link, such as a header and a footer.
- Don't add UTM tags to links that only point inside your own site; they overwrite the original source of the visit.

## Next steps

- [Organizing campaigns](/docs/en/guides/campaigns/organizing-campaigns)
- [Managing links](/docs/en/guides/links/managing-links)
