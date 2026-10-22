import { expect, test } from "bun:test";
import { renderEmail } from "./render";
import { PlatformNotice } from "./templates/platform";
for (const locale of ["en", "pt", "es"] as const)
  test(`platform mail preserves public copy and escapes details in ${locale}`, async () => {
    const rendered = await renderEmail(
      <PlatformNotice
        locale={locale}
        kind="accountDeletionScheduled"
        details={[
          { label: "Deletion date", value: "2026-10-30T12:00:00Z" },
          { label: "Note", value: '<script>alert("x")</script>' },
        ]}
      />,
    );
    expect(rendered.html).not.toContain('<script>alert("x")</script>');
    expect(rendered.text).toContain("UTC");
    expect(rendered.text).toContain(
      locale === "pt"
        ? "Data de eliminação"
        : locale === "es"
          ? "Fecha de eliminación"
          : "Deletion date",
    );
    expect(rendered.html).toContain("&lt;script&gt;");
  });
