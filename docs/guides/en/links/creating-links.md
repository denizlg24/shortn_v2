# Creating links

A short link sends visitors to a destination URL and counts each visit. This guide covers the new-link form, from the destination to the advanced redirect rules, and importing links in bulk.

## Create a link

1. Open **Links** in the sidebar and select **New link**. You can also paste a URL anywhere on the Links page outside a text field, or press C.
2. Enter the **Destination URL**. This is the only required field.
3. Fill in any optional fields described below.
4. Select **Create link**.

Shortn copies the new short link to your clipboard and opens its overview. Each link you create counts towards your plan's monthly link limit, shown under **Usage** in the sidebar.

## Title and key suggestions

When you paste a destination, Shortn looks up the page. Once the details arrive, select **Use page title** to fill in the **Title**, or **Use suggested key** to take a readable key. Your own edits are never overwritten. If the page can't be read, enter a title yourself or leave it empty.

## Custom key

The key is the part after the domain, for example `example` in `shortn.at/example`. Leave **Custom key** empty for a random key, or type your own using letters, digits, `-` and `_`. Custom keys depend on your plan; if yours doesn't include them, the form says which plan does.

If you later rename a key, the old key keeps redirecting to the same link.

## Title, description and tags

**Title** and **Description** help you find the link in lists and analytics. Visitors don't see them.

Under **Tags**, search for an existing tag or type a new one to create it. A link can carry up to 50 tags. Tags power the filters on the Links page, in the campaign builder and in the bio page link picker.

## Password

Under **Password**, set a password that visitors must enter before they reach the destination, plus an optional **Hint** shown on the password page. Password protection depends on your plan.

## Advanced options

Expand **Advanced options** for redirect rules. Each group shows a one-line summary of its current setting.

- **Schedule and expiry**: set **Available from (UTC)** and **Expires at (UTC)**, an **Approximate lifetime visit limit**, and a **Fallback URL when unavailable** for visitors who arrive outside that window. The visit limit includes QR scans and is approximate, because simultaneous visits can exceed it.
- **Country targeting**: send visitors from specific countries to other URLs. Use two-letter country codes; the first matching rule wins.
- **Device targeting**: route by operating system, device type, or both.
- **Weighted rotation**: split traffic between up to 10 destinations by relative weight. Returning visitors keep the same destination.
- **App links**: open an iOS or Android app, with a fallback to the web destination or the app store.
- **Redirect and query parameters**: forward incoming query parameters, use a permanent HTTP 301 redirect, and set fixed UTM values. See [UTM parameters](/docs/en/guides/links/utm-parameters).
- **Social preview**: set the title, description and image that link-preview bots show when the link is shared.

## Import links from a CSV file

To create many links at once, select **Import** on the Links page. Upload a UTF-8 CSV file with a header row, up to 50,000 rows, then map its columns, review the validation results and create the valid links. Imported links count towards your plan's monthly limit.

## After you create a link

The link's page has tabs for **Overview**, **Analytics**, **QR code**, **UTM variants** and **Edit**. From the **QR code** tab you can select **Create a QR code** to make a printable code that uses this link.

Changes you save on **Edit** apply from the next click.

## Next steps

- [Managing links](/docs/en/guides/links/managing-links)
- [UTM parameters](/docs/en/guides/links/utm-parameters)
- [Creating QR codes](/docs/en/guides/qr-codes/creating-qr-codes)
