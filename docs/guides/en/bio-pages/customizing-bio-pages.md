# Customizing bio pages

The bio page editor works on a draft: you change sections, theme and settings, check the live preview, and publish when you're ready. This guide covers each part of the editor, scheduling, versions and connecting your own domain.

Open a bio page and select **Edit bio page**. The toolbar has **Add section**, **Sections**, **Theme**, **Page settings** and **History**.

## Sections

Select **Add section** to add one of these:

- **Profile**: avatar, title, description and alignment. You can choose the avatar shape.
- **Link**: one button for a link. Turn on **Highlight this link** to make it stand out, and add a thumbnail.
- **Links**: a group of links. Select **Manage links** to filter by tags, search, select links across pages and add them in one step. Under **Display links**, choose a layout such as a vertical list, paginated cards or image grids.
- **Social links**: icons that link to your profiles on other platforms.
- **Section heading** and **Text**: headings and short paragraphs between your links.
- **Image**: an image with a description and an optional link.
- **Embed**: content from YouTube, Spotify, SoundCloud, Vimeo or Apple Music. Visitors see a button to load it, with a note that loading the content shares their IP address with the provider.
- **QR code**: a QR code for one of your links.

Select a section in the preview to edit it, and drag its handle to reorder. **Sections** lists every section in order.

## Show sections on a schedule

Each section has a **Visible** switch and optional **Show from (UTC)** and **Show until (UTC)** dates. Use them to show a ticket link only during an event, or hide a section without deleting it. Scheduling is available on paid plans.

## Theme

Open **Theme** to change how the page looks:

1. Pick a **Preset theme** as a starting point, or choose **Custom**.
2. Adjust the colours: **Background**, **Surface**, **Text** and **Accent**.
3. Choose a **Font**, a **Button style**, a **Corner radius** and the **Spacing**.
4. Optionally add a **Cover image (optional)** behind the profile.

Themes are constrained so pages stay readable. If the text contrast is too low, the editor tells you so; select **Use accessible color** to fix it.

## Page settings

**Page settings** holds the settings that apply to the whole page:

- **Handle**: the name in the page's address. Select **Change handle** to rename it; previous addresses keep working.
- **Page language**: the language the page is written in.
- **Hide Shortn footer**: removes the "Made with Shortn" footer. Available on paid plans.
- **Search appearance**: turn on **Hide from search engines** to keep the page out of search results.

## Drafts and publishing

Your changes save as a draft a moment after you stop typing, and you can save at any time with **Save draft**. The preview shows the draft; visitors keep seeing the published page until you select **Publish**.

If the page was changed in another session, the editor warns you before saving, so you don't overwrite someone else's work.

## Versions

Every publish creates a version. Open **History** to see **Published versions (last 20)**. To go back, select **Restore version … to draft** on the one you want. The version is copied into your draft; select **Publish** to make it live again.

## Use your own domain

You can serve a bio page from your own domain, such as `links.example.com`, with the custom-domain add-on. Each add-on includes one domain.

1. Open **Settings** and select **Domains**.
2. If you don't have a free domain allowance, select **Buy domain add-on**.
3. Under **Add domain**, enter the **Hostname**, choose what to **Use for**, pick the **Bio page**, and select **Add domain**.
4. Follow the **DNS instructions**: create the CNAME record shown at your DNS provider. For an apex domain, use CNAME flattening.
5. Wait for the status to change to **Active**. If verification fails, check the record and select **Retry verification**.

Only people who can manage billing can add domains.

## Next steps

- [Creating bio pages](/docs/en/guides/bio-pages/creating-bio-pages)
- [Upgrading plans](/docs/en/guides/billing/upgrading-plans)
