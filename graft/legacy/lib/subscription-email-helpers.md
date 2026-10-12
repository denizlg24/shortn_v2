# legacy/lib/subscription-email-helpers.ts

- fetchInvoiceAttachment · function · L18-L34 — async function fetchInvoiceAttachment(invoiceUrl: string)
- getPlanFeatures · function · L39-L76 — function getPlanFeatures(planName: string): string[]
- formatCurrency · function · L81-L83 — function formatCurrency(amount: number, _currency: string): string
- sendSubscriptionCreatedEmail · function · L88-L106 — async function sendSubscriptionCreatedEmail(params: { userEmail: string; userName: string; planName: string; })
- sendSubscriptionActiveEmail · function · L111-L130 — async function sendSubscriptionActiveEmail(params: { userEmail: string; userName: string; planName: string; nextBillingDate: Date; })
- sendPaymentSuccessfulEmail · function · L135-L171 — async function sendPaymentSuccessfulEmail(params: { userEmail: string; userName: string; planName: string; amount: number; currency: string; nextBillingDate: Date; invoiceUrl?: string; })
- sendSubscriptionCanceledEmail · function · L176-L196 — async function sendSubscriptionCanceledEmail(params: { userEmail: string; userName: string; planName: string; endDate: Date; })
- sendSubscriptionUncanceledEmail · function · L201-L220 — async function sendSubscriptionUncanceledEmail(params: { userEmail: string; userName: string; planName: string; nextBillingDate: Date; })
- sendSubscriptionRevokedEmail · function · L225-L242 — async function sendSubscriptionRevokedEmail(params: { userEmail: string; userName: string; planName: string; })
- sendOrderRefundedEmail · function · L247-L268 — async function sendOrderRefundedEmail(params: { userEmail: string; userName: string; amount: number; currency: string; refundReason?: string; })
- sendPaymentFailedEmail · function · L273-L304 — async function sendPaymentFailedEmail(params: { userEmail: string; userName: string; planName: string; amount?: number; currency?: string; failureReason?: string; })
