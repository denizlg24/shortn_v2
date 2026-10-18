import { render } from "@react-email/components";
import { createElement, type ReactElement } from "react";
import { LogoContext } from "./layout";

/**
 * The HTML and plain-text bodies exactly as the mailer sends them. `logoUrl`
 * is the hosted brand mark; without it the header uses the text mark.
 */
export async function renderEmail(
  email: ReactElement,
  options: { logoUrl?: string | undefined } = {},
) {
  const element = createElement(
    LogoContext.Provider,
    { value: options.logoUrl },
    email,
  );
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
