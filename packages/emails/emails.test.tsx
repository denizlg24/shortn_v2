import { expect, test } from "bun:test";
import { render } from "@react-email/components";
import { recipientAllowed } from "./index";
import { locales } from "./messages";
import { ResetPassword, WorkspaceInvite } from "./templates/account";

test("allowlist matches exact addresses and domain suffixes", () => {
  expect(recipientAllowed(undefined, "a@b.com")).toBe(true);
  expect(recipientAllowed("", "a@b.com")).toBe(true);
  expect(recipientAllowed("@shortn.at, me@x.com", "Ops@Shortn.at")).toBe(true);
  expect(recipientAllowed("@shortn.at, me@x.com", "me@x.com")).toBe(true);
  expect(
    recipientAllowed("@shortn.at, me@x.com", "someone@evil-shortn.at.com"),
  ).toBe(false);
  expect(recipientAllowed("@shortn.at", "customer@gmail.com")).toBe(false);
});

test("every locale renders the templates with the action URL", async () => {
  for (const locale of locales) {
    const reset = await render(
      <ResetPassword locale={locale} url="https://app.shortn.at/reset?t=1" />,
    );
    expect(reset).toContain("https://app.shortn.at/reset?t=1");
    expect(reset).toContain(`lang="${locale}"`);
    const invite = await render(
      <WorkspaceInvite
        locale={locale}
        inviter="Ana"
        workspace="Vida"
        role="viewer"
        url="https://x.y/i"
      />,
    );
    expect(invite).toContain("Vida");
  }
});
