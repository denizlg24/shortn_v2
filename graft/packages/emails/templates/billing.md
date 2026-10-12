# packages/emails/templates/billing.tsx

- BillingNotice · type · L4-L9 — type BillingNotice = | { kind: "started"; plan: string } | { kind: "changed"; plan: string } | { kind: "scheduled"; plan: string; date: string } | { kind: "canceled"; date: string } | { kind: "payment_failed" };
- billingSubject · function · L11-L25 — function billingSubject(locale: Locale, notice: BillingNotice)
- body · function · L27-L41 — function body(locale: Locale, workspace: string, notice: BillingNotice)
- BillingEmail · function · L43-L67 — function BillingEmail({ locale, workspace, notice, url, }: { locale: Locale; workspace: string; notice: BillingNotice; url: string; })
