import { render } from "@react-email/components";
import type { ReactElement } from "react";

/** The HTML and plain-text bodies exactly as the mailer sends them. */
export async function renderEmail(element: ReactElement) {
  const [html, text] = await Promise.all([
    render(element),
    render(element, {
      plainText: true,
      htmlToTextOptions: {
        selectors: [
          { selector: "h1", options: { uppercase: false } },
          {
            selector: "table.details",
            format: "dataTable",
            options: {
              colSpacing: 3,
              maxColumnWidth: 60,
              rowSpacing: 0,
              uppercaseHeaderCells: false,
            },
          },
          {
            selector: "a.site",
            format: "anchor",
            options: { ignoreHref: true },
          },
        ],
      },
    }),
  ]);
  return { html, text };
}
