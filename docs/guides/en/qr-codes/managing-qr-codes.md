# Managing QR codes

This guide covers the design options for a QR code, exporting files for print, exporting many codes at once as a ZIP file, and deleting codes.

## Find your codes

Open **QR codes** in the sidebar. Use **Search** to match the title, destination or code, filter by **Tag** and **Created**, and switch the **Layout** between **Grid** and **List**. Select a code to open its overview, where the **Overview**, **Design**, **Scans** and **Details** tabs live.

## Design options

Open the **Design** tab. The preview updates as you change options and notes when it includes unsaved changes. Select **Save design** to apply them.

- **Colours**: pick a preset or set the **Code** and **Background** colours. Under **Corners**, keep the code colour or choose a separate corner colour.
- **Pattern**: choose the shape of the **Dots**, **Corner squares** and **Corner dots**. Shapes change the look only; the link inside stays the same.
- **Error correction**: choose a **Level**. Higher levels let a code survive scuffs and a logo, at the cost of a denser pattern.
- **Logo**: upload an image to draw in the middle of the code, set the **Logo size**, and optionally **Hide the pattern behind the logo**. Keep the logo at 50% of the error correction or less. Logos depend on your plan.
- **Shape and caption**: choose a square or circular **Shape**, a **Frame** (none, outline or solid) and an optional **Caption** of up to 64 characters. Frames and captions stay outside the clear space around the code, and both appear in downloads.

The **Scan check** panel rates the contrast between code and background and warns about inverted colours, a transparent background and logo size. Treat its warnings as a prompt to test with real phones before printing.

## Export for print

1. On the code's overview, under **Download**, select **Export for print**.
2. Choose a **Format** (SVG, PNG or PDF) and a **Size**.
3. Read the print guidance on the page: four quiet modules around the code, error correction Q (H with a logo), at least 3:1 contrast, and the recommended minimum print size at 300 dpi.
4. Select **Prepare download**, then **Download file**.

Downloads expire 24 hours after you start the export. For screen use, **JPEG for screens** on the overview gives you a JPEG straight away.

## Export several codes as a ZIP

1. On the QR codes list, tick the codes you want, or use **Select this page**. Your selection stays as you change pages and filters.
2. Select **Export selected**.
3. Review the selection. Filters on this page only change the list you see; the ZIP includes every selected code.
4. Choose a **Format** and **Size**, then select **Create ZIP**.
5. When the export is ready, select **Download ZIP**.

The export page shows how many codes fit in one ZIP file. You can leave the page while the export runs; it continues in the background.

## Edit details and destination

The **Details** tab holds the **Destination URL**, **Title** and **Tags**. Changing the destination doesn't change the printed pattern; printed copies follow the new destination from the next scan. Select **Save details** to apply.

## Scans

The overview summarises the last 30 days: scans, visitors, all-time scans and the date of the last scan. The **Scans** tab opens the full analytics for the code. Scans also appear in the workspace **Analytics** page, separate from link clicks. See [Understanding analytics](/docs/en/guides/analytics/understanding-analytics).

## Delete QR codes

Select **Delete QR code** on the overview, or select codes in the list and choose **Delete selected**. The confirmation page lists what happens:

- the code stops scanning right away, because its short link is deleted with it;
- links the code was attached to keep working and only lose their QR code;
- scan history is archived and no longer shown.

Deleting a QR code can't be undone, and printed copies can't be brought back. Members can delete only the codes they created.

## Next steps

- [Creating QR codes](/docs/en/guides/qr-codes/creating-qr-codes)
- [Creating bio pages](/docs/en/guides/bio-pages/creating-bio-pages)
