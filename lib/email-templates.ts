/**
 * Clean, minimalist HTML email templates for Shortn
 * Compatible with all email clients
 */

const baseStyles = {
  primary: "#2d3748", // Dark blue-gray matching your theme
  primaryLight: "#4a5568",
  background: "#ffffff",
  textPrimary: "#1a202c",
  textSecondary: "#718096",
  border: "#e2e8f0",
  success: "#48bb78",
  danger: "#f56565",
};

// Base email wrapper with consistent styling
const emailWrapper = (content: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Shortn</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f7fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f7fafc;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: ${baseStyles.primary};">Shortn</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 0 40px 40px 40px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f7fafc; border-top: 1px solid ${baseStyles.border}; border-radius: 0 0 8px 8px;">
              <p style="margin: 0 0 10px 0; font-size: 12px; color: ${baseStyles.textSecondary}; text-align: center;">
                This email was sent by Shortn
              </p>
              <p style="margin: 0; font-size: 12px; color: ${baseStyles.textSecondary}; text-align: center;">
                © ${new Date().getFullYear()} Shortn. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// Button component
const button = (href: string, text: string, isPrimary = true) => `
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin: 30px 0;">
    <tr>
      <td style="border-radius: 6px; background-color: ${isPrimary ? baseStyles.primary : baseStyles.border};">
        <a href="${href}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 15px; font-weight: 500; color: ${isPrimary ? "#ffffff" : baseStyles.textPrimary}; text-decoration: none; border-radius: 6px;">
          ${text}
        </a>
      </td>
    </tr>
  </table>
`;

// Divider
const divider = () => `
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 30px 0;">
    <tr>
      <td style="border-top: 1px solid ${baseStyles.border};"></td>
    </tr>
  </table>
`;

/**
 * Verification Email Template
 */
export const verificationEmailTemplate = (params: {
  verificationLink: string;
  userName?: string;
}) => {
  const content = `
    <h2 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 600; color: ${baseStyles.textPrimary};">
      Verify your email address
    </h2>
    <p style="margin: 0 0 15px 0; font-size: 15px; line-height: 24px; color: ${baseStyles.textSecondary};">
      ${params.userName ? `Hi ${params.userName},` : "Hello,"}
    </p>
    <p style="margin: 0 0 15px 0; font-size: 15px; line-height: 24px; color: ${baseStyles.textSecondary};">
      Thanks for signing up with Shortn! To complete your registration, please verify your email address by clicking the button below.
    </p>
    ${button(params.verificationLink, "Verify Email Address")}
    <p style="margin: 0 0 15px 0; font-size: 14px; line-height: 22px; color: ${baseStyles.textSecondary};">
      Or copy and paste this link in your browser:
    </p>
    <p style="margin: 0 0 15px 0; font-size: 13px; line-height: 20px; color: ${baseStyles.primaryLight}; word-break: break-all;">
      ${params.verificationLink}
    </p>
    ${divider()}
    <p style="margin: 0; font-size: 13px; line-height: 20px; color: ${baseStyles.textSecondary};">
      If you didn't create an account with Shortn, you can safely ignore this email.
    </p>
  `;
  return emailWrapper(content);
};

/**
 * Welcome Email Template
 */
export const welcomeEmailTemplate = (params: {
  userName: string;
  dashboardLink: string;
}) => {
  const content = `
    <h2 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 600; color: ${baseStyles.textPrimary};">
      Welcome to Shortn
    </h2>
    <p style="margin: 0 0 15px 0; font-size: 15px; line-height: 24px; color: ${baseStyles.textSecondary};">
      Hi ${params.userName},
    </p>
    <p style="margin: 0 0 15px 0; font-size: 15px; line-height: 24px; color: ${baseStyles.textSecondary};">
      Your email has been verified successfully. You're all set to start shortening URLs and tracking your links.
    </p>
    <p style="margin: 0 0 15px 0; font-size: 15px; line-height: 24px; color: ${baseStyles.textSecondary};">
      Here's what you can do with Shortn:
    </p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 20px 0;">
      <tr>
        <td style="padding: 15px; background-color: #f7fafc; border-radius: 6px;">
          <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 500; color: ${baseStyles.textPrimary};">Create short links</p>
          <p style="margin: 0; font-size: 13px; line-height: 20px; color: ${baseStyles.textSecondary};">Turn long URLs into short, shareable links</p>
        </td>
      </tr>
      <tr><td style="height: 10px;"></td></tr>
      <tr>
        <td style="padding: 15px; background-color: #f7fafc; border-radius: 6px;">
          <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 500; color: ${baseStyles.textPrimary};">Track analytics</p>
          <p style="margin: 0; font-size: 13px; line-height: 20px; color: ${baseStyles.textSecondary};">See clicks, locations, and more</p>
        </td>
      </tr>
      <tr><td style="height: 10px;"></td></tr>
      <tr>
        <td style="padding: 15px; background-color: #f7fafc; border-radius: 6px;">
          <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 500; color: ${baseStyles.textPrimary};">Generate QR codes</p>
          <p style="margin: 0; font-size: 13px; line-height: 20px; color: ${baseStyles.textSecondary};">Create custom QR codes for your links</p>
        </td>
      </tr>
    </table>
    ${button(params.dashboardLink, "Go to Dashboard")}
    ${divider()}
    <p style="margin: 0; font-size: 13px; line-height: 20px; color: ${baseStyles.textSecondary};">
      Need help getting started? Contact support@shortn.at
    </p>
  `;
  return emailWrapper(content);
};

/**
 * Password Reset Email Template
 */
export const resetPasswordEmailTemplate = (params: {
  resetLink: string;
  expiryMinutes?: number;
}) => {
  const content = `
    <h2 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 600; color: ${baseStyles.textPrimary};">
      Reset your password
    </h2>
    <p style="margin: 0 0 15px 0; font-size: 15px; line-height: 24px; color: ${baseStyles.textSecondary};">
      We received a request to reset your password for your Shortn account.
    </p>
    <p style="margin: 0 0 15px 0; font-size: 15px; line-height: 24px; color: ${baseStyles.textSecondary};">
      Click the button below to set a new password. If you didn't request this, you can safely ignore this email.
    </p>
    ${button(params.resetLink, "Reset Password")}
    <p style="margin: 0 0 15px 0; font-size: 14px; line-height: 22px; color: ${baseStyles.textSecondary};">
      Or copy and paste this link in your browser:
    </p>
    <p style="margin: 0 0 15px 0; font-size: 13px; line-height: 20px; color: ${baseStyles.primaryLight}; word-break: break-all;">
      ${params.resetLink}
    </p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 20px 0;">
      <tr>
        <td style="padding: 15px; background-color: #fffbeb; border-left: 3px solid #f59e0b; border-radius: 4px;">
          <p style="margin: 0; font-size: 13px; line-height: 20px; color: ${baseStyles.textSecondary};">
            This link will expire in ${params.expiryMinutes || 10} minutes for security purposes.
          </p>
        </td>
      </tr>
    </table>
    ${divider()}
    <p style="margin: 0; font-size: 13px; line-height: 20px; color: ${baseStyles.textSecondary};">
      Shortn will never ask you to disclose or verify your password via email.
    </p>
  `;
  return emailWrapper(content);
};

/**
 * Email Update Verification Template
 */
export const updateEmailVerificationTemplate = (params: {
  verificationLink: string;
  newEmail: string;
}) => {
  const content = `
    <h2 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 600; color: ${baseStyles.textPrimary};">
      Verify your new email address
    </h2>
    <p style="margin: 0 0 15px 0; font-size: 15px; line-height: 24px; color: ${baseStyles.textSecondary};">
      You've requested to change your email address to:
    </p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 20px 0;">
      <tr>
        <td style="padding: 15px; background-color: #f7fafc; border-radius: 6px; text-align: center;">
          <p style="margin: 0; font-size: 15px; font-weight: 500; color: ${baseStyles.textPrimary};">
            ${params.newEmail}
          </p>
        </td>
      </tr>
    </table>
    <p style="margin: 0 0 15px 0; font-size: 15px; line-height: 24px; color: ${baseStyles.textSecondary};">
      To complete this change, please verify your new email address by clicking the button below.
    </p>
    ${button(params.verificationLink, "Verify New Email")}
    <p style="margin: 0 0 15px 0; font-size: 14px; line-height: 22px; color: ${baseStyles.textSecondary};">
      Or copy and paste this link in your browser:
    </p>
    <p style="margin: 0 0 15px 0; font-size: 13px; line-height: 20px; color: ${baseStyles.primaryLight}; word-break: break-all;">
      ${params.verificationLink}
    </p>
    ${divider()}
    <p style="margin: 0; font-size: 13px; line-height: 20px; color: ${baseStyles.textSecondary};">
      If you didn't request this change, please ignore this email or contact support if you have concerns.
    </p>
  `;
  return emailWrapper(content);
};

/**
 * Email Verified Notification Template
 */
export const emailVerifiedTemplate = (params: {
  userName?: string;
  dashboardLink: string;
}) => {
  const content = `
    <h2 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 600; color: ${baseStyles.textPrimary};">
      Email Verified Successfully
    </h2>
    <p style="margin: 0 0 15px 0; font-size: 15px; line-height: 24px; color: ${baseStyles.textSecondary};">
      ${params.userName ? `Hi ${params.userName},` : "Hello,"}
    </p>
    <p style="margin: 0 0 15px 0; font-size: 15px; line-height: 24px; color: ${baseStyles.textSecondary};">
      Your email address has been successfully verified. You now have full access to all Shortn features.
    </p>
    ${button(params.dashboardLink, "Access Your Dashboard")}
    ${divider()}
    <p style="margin: 0; font-size: 13px; line-height: 20px; color: ${baseStyles.textSecondary};">
      Start creating and managing your short links today.
    </p>
  `;
  return emailWrapper(content);
};

/**
 * Confirm Email Change Request Template
 */
export const confirmEmailChangeTemplate = (params: {
  confirmLink: string;
  userName: string;
  newEmail: string;
}) => {
  const content = `
    <h2 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 600; color: ${baseStyles.textPrimary};">
      Email change requested
    </h2>
    <p style="margin: 0 0 15px 0; font-size: 15px; line-height: 24px; color: ${baseStyles.textSecondary};">
      Hi ${params.userName},
    </p>
    <p style="margin: 0 0 15px 0; font-size: 15px; line-height: 24px; color: ${baseStyles.textSecondary};">
      We received a request to change your email address to:
    </p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 20px 0;">
      <tr>
        <td style="padding: 15px; background-color: #f7fafc; border-radius: 6px; text-align: center;">
          <p style="margin: 0; font-size: 15px; font-weight: 500; color: ${baseStyles.textPrimary};">
            ${params.newEmail}
          </p>
        </td>
      </tr>
    </table>
    <p style="margin: 0 0 15px 0; font-size: 15px; line-height: 24px; color: ${baseStyles.textSecondary};">
      To confirm this change, click the button below. After confirmation, you'll receive a verification email at your new address.
    </p>
    ${button(params.confirmLink, "Confirm Email Change")}
    <p style="margin: 0 0 15px 0; font-size: 14px; line-height: 22px; color: ${baseStyles.textSecondary};">
      Or copy and paste this link in your browser:
    </p>
    <p style="margin: 0 0 15px 0; font-size: 13px; line-height: 20px; color: ${baseStyles.primaryLight}; word-break: break-all;">
      ${params.confirmLink}
    </p>
    ${divider()}
    <p style="margin: 0; font-size: 13px; line-height: 20px; color: ${baseStyles.textSecondary};">
      If you didn't request this change, please ignore this email and your account will remain unchanged.
    </p>
  `;
  return emailWrapper(content);
};

/**
 * Subscription Created Email Template
 */
export const subscriptionCreatedTemplate = (params: {
  userName: string;
  planName: string;
  dashboardLink: string;
  features: string[];
  amount?: string;
  subtotal?: string;
  discount?: {
    name: string;
    code?: string;
    amount: string;
    percentOff?: number;
  };
  tax?: string;
  total?: string;
  nextBillingDate?: string;
  billingPeriod?: string;
  cardLast4?: string;
  cardBrand?: string;
  billingEmail?: string;
  invoiceNumber?: string;
  transactionDate?: string;
  taxId?: string;
  companyName?: string;
  billingAddress?: string;
  phoneNumber?: string;
}) => {
  const content = `
    <h2 style="margin: 0 0 10px 0; font-size: 20px; font-weight: 600; color: ${baseStyles.textPrimary};">
      Payment Receipt
    </h2>
    <p style="margin: 0 0 5px 0; font-size: 13px; color: ${baseStyles.textSecondary};">
      ${params.transactionDate || new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
    </p>
    ${
      params.invoiceNumber
        ? `
    <p style="margin: 0 0 25px 0; font-size: 13px; color: ${baseStyles.textSecondary};">
      Invoice #${params.invoiceNumber}
    </p>
    `
        : '<p style="margin: 0 0 25px 0;"></p>'
    }
    
    <p style="margin: 0 0 15px 0; font-size: 15px; line-height: 24px; color: ${baseStyles.textSecondary};">
      Hi ${params.userName},
    </p>
    <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 24px; color: ${baseStyles.textSecondary};">
      Thank you for your payment. Your <strong>${params.planName}</strong> subscription is now active.
    </p>
    
    <!-- Payment Summary -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 25px 0; border: 1px solid ${baseStyles.border}; border-radius: 6px;">
      <tr>
        <td style="padding: 20px; background-color: #fafbfc;">
          <p style="margin: 0 0 15px 0; font-size: 13px; font-weight: 600; color: ${baseStyles.textPrimary}; text-transform: uppercase; letter-spacing: 0.5px;">
            Payment Summary
          </p>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textSecondary};">Description</td>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textPrimary}; text-align: right; font-weight: 500;">${params.planName}${params.billingPeriod ? ` - ${params.billingPeriod}` : ""}</td>
            </tr>
            ${
              params.subtotal
                ? `
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textSecondary};">Subtotal</td>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textPrimary}; text-align: right;">${params.subtotal}</td>
            </tr>
            `
                : ""
            }
            ${
              params.discount
                ? `
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textSecondary};">
                Discount${params.discount.code ? ` (${params.discount.code})` : ""}${params.discount.percentOff ? ` - ${params.discount.percentOff}% off` : ""}
              </td>
              <td style="padding: 8px 0; font-size: 14px; color: #10b981; text-align: right;">-${params.discount.amount}</td>
            </tr>
            `
                : ""
            }
            ${
              params.tax
                ? `
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textSecondary};">Tax</td>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textPrimary}; text-align: right;">${params.tax}</td>
            </tr>
            `
                : ""
            }
            <tr style="border-top: 1px solid ${baseStyles.border};">
              <td style="padding: 12px 0 8px 0; font-size: 15px; color: ${baseStyles.textPrimary}; font-weight: 600;">Total</td>
              <td style="padding: 12px 0 8px 0; font-size: 15px; color: ${baseStyles.textPrimary}; text-align: right; font-weight: 600;">${params.total || params.amount || "$0.00"}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Payment Method & Billing -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 25px 0; border: 1px solid ${baseStyles.border}; border-radius: 6px;">
      <tr>
        <td style="padding: 20px; background-color: #fafbfc;">
          <p style="margin: 0 0 15px 0; font-size: 13px; font-weight: 600; color: ${baseStyles.textPrimary}; text-transform: uppercase; letter-spacing: 0.5px;">
            Billing Information
          </p>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            ${
              params.cardBrand && params.cardLast4
                ? `
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textSecondary};">Payment method</td>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textPrimary}; text-align: right; font-weight: 500;">${params.cardBrand} •••• ${params.cardLast4}</td>
            </tr>
            `
                : ""
            }
            ${
              params.billingEmail
                ? `
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textSecondary};">Billing email</td>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textPrimary}; text-align: right; font-weight: 500;">${params.billingEmail}</td>
            </tr>
            `
                : ""
            }
            ${
              params.nextBillingDate
                ? `
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textSecondary};">Next billing date</td>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textPrimary}; text-align: right; font-weight: 500;">${params.nextBillingDate}</td>
            </tr>
            `
                : ""
            }
            ${
              params.amount
                ? `
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textSecondary};">Billing amount</td>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textPrimary}; text-align: right; font-weight: 500;">${params.amount} + tax</td>
            </tr>
            `
                : ""
            }
            ${
              params.companyName
                ? `
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textSecondary};">Company name</td>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textPrimary}; text-align: right; font-weight: 500;">${params.companyName}</td>
            </tr>
            `
                : ""
            }
            ${
              params.taxId
                ? `
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textSecondary};">Tax ID</td>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textPrimary}; text-align: right; font-weight: 500;">${params.taxId}</td>
            </tr>
            `
                : ""
            }
            ${
              params.billingAddress
                ? `
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textSecondary};">Billing address</td>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textPrimary}; text-align: right; font-weight: 500;">${params.billingAddress}</td>
            </tr>
            `
                : ""
            }
            ${
              params.phoneNumber
                ? `
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textSecondary};">Phone number</td>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textPrimary}; text-align: right; font-weight: 500;">${params.phoneNumber}</td>
            </tr>
            `
                : ""
            }
          </table>
        </td>
      </tr>
    </table>

    <!-- Plan Features -->
    <p style="margin: 25px 0 12px 0; font-size: 14px; font-weight: 600; color: ${baseStyles.textPrimary};">
      Your plan includes:
    </p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
      ${params.features
        .map(
          (feature) => `
        <tr>
          <td style="padding: 6px 0; font-size: 14px; line-height: 20px; color: ${baseStyles.textSecondary};">
            • ${feature}
          </td>
        </tr>
      `,
        )
        .join("")}
    </table>

    ${button(params.dashboardLink, "Manage Subscription")}
    ${divider()}
    <p style="margin: 0 0 8px 0; font-size: 13px; line-height: 20px; color: ${baseStyles.textSecondary};">
      Questions about your subscription or billing?
    </p>
    <p style="margin: 0; font-size: 13px; line-height: 20px; color: ${baseStyles.textSecondary};">
      Contact us at support@shortn.at
    </p>
  `;
  return emailWrapper(content);
};

/**
 * Subscription Upgraded Email Template
 */
export const subscriptionUpgradedTemplate = (params: {
  userName: string;
  oldPlan: string;
  newPlan: string;
  dashboardLink: string;
  newFeatures: string[];
  amount?: string;
  subtotal?: string;
  discount?: {
    name: string;
    code?: string;
    amount: string;
    percentOff?: number;
  };
  tax?: string;
  total?: string;
  proratedCredit?: string;
  nextBillingDate?: string;
  effectiveDate?: string;
  billingPeriod?: string;
  cardLast4?: string;
  cardBrand?: string;
  billingEmail?: string;
  invoiceNumber?: string;
  taxId?: string;
  companyName?: string;
  billingAddress?: string;
  phoneNumber?: string;
}) => {
  const content = `
    <h2 style="margin: 0 0 10px 0; font-size: 20px; font-weight: 600; color: ${baseStyles.textPrimary};">
      Subscription Updated - Payment Receipt
    </h2>
    <p style="margin: 0 0 5px 0; font-size: 13px; color: ${baseStyles.textSecondary};">
      ${params.effectiveDate || new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
    </p>
    ${
      params.invoiceNumber
        ? `
    <p style="margin: 0 0 25px 0; font-size: 13px; color: ${baseStyles.textSecondary};">
      Invoice #${params.invoiceNumber}
    </p>
    `
        : '<p style="margin: 0 0 25px 0;"></p>'
    }
    
    <p style="margin: 0 0 15px 0; font-size: 15px; line-height: 24px; color: ${baseStyles.textSecondary};">
      Hi ${params.userName},
    </p>
    <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 24px; color: ${baseStyles.textSecondary};">
      Your subscription has been updated from <strong>${params.oldPlan}</strong> to <strong>${params.newPlan}</strong>.
    </p>
    
    <!-- Plan Change Summary -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 25px 0; border: 1px solid ${baseStyles.border}; border-radius: 6px;">
      <tr>
        <td style="padding: 20px; background-color: #fafbfc;">
          <p style="margin: 0 0 15px 0; font-size: 13px; font-weight: 600; color: ${baseStyles.textPrimary}; text-transform: uppercase; letter-spacing: 0.5px;">
            Subscription Change
          </p>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textSecondary};">Previous plan</td>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textSecondary}; text-align: right; text-decoration: line-through;">${params.oldPlan}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textSecondary};">New plan</td>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textPrimary}; text-align: right; font-weight: 500;">${params.newPlan}${params.billingPeriod ? ` - ${params.billingPeriod}` : ""}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Payment Summary -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 25px 0; border: 1px solid ${baseStyles.border}; border-radius: 6px;">
      <tr>
        <td style="padding: 20px; background-color: #fafbfc;">
          <p style="margin: 0 0 15px 0; font-size: 13px; font-weight: 600; color: ${baseStyles.textPrimary}; text-transform: uppercase; letter-spacing: 0.5px;">
            Payment Summary
          </p>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            ${
              params.subtotal
                ? `
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textSecondary};">Subtotal</td>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textPrimary}; text-align: right;">${params.subtotal}</td>
            </tr>
            `
                : ""
            }
            ${
              params.proratedCredit
                ? `
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textSecondary};">Prorated credit</td>
              <td style="padding: 8px 0; font-size: 14px; color: #10b981; text-align: right;">-${params.proratedCredit}</td>
            </tr>
            `
                : ""
            }
            ${
              params.discount
                ? `
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textSecondary};">
                Discount${params.discount.code ? ` (${params.discount.code})` : ""}${params.discount.percentOff ? ` - ${params.discount.percentOff}% off` : ""}
              </td>
              <td style="padding: 8px 0; font-size: 14px; color: #10b981; text-align: right;">-${params.discount.amount}</td>
            </tr>
            `
                : ""
            }
            ${
              params.tax
                ? `
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textSecondary};">Tax</td>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textPrimary}; text-align: right;">${params.tax}</td>
            </tr>
            `
                : ""
            }
            <tr style="border-top: 1px solid ${baseStyles.border};">
              <td style="padding: 12px 0 8px 0; font-size: 15px; color: ${baseStyles.textPrimary}; font-weight: 600;">Total charged</td>
              <td style="padding: 12px 0 8px 0; font-size: 15px; color: ${baseStyles.textPrimary}; text-align: right; font-weight: 600;">${params.total || params.amount || "$0.00"}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Billing Information -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 25px 0; border: 1px solid ${baseStyles.border}; border-radius: 6px;">
      <tr>
        <td style="padding: 20px; background-color: #fafbfc;">
          <p style="margin: 0 0 15px 0; font-size: 13px; font-weight: 600; color: ${baseStyles.textPrimary}; text-transform: uppercase; letter-spacing: 0.5px;">
            Billing Information
          </p>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            ${
              params.cardBrand && params.cardLast4
                ? `
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textSecondary};">Payment method</td>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textPrimary}; text-align: right; font-weight: 500;">${params.cardBrand} •••• ${params.cardLast4}</td>
            </tr>
            `
                : ""
            }
            ${
              params.billingEmail
                ? `
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textSecondary};">Billing email</td>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textPrimary}; text-align: right; font-weight: 500;">${params.billingEmail}</td>
            </tr>
            `
                : ""
            }
            ${
              params.nextBillingDate
                ? `
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textSecondary};">Next billing date</td>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textPrimary}; text-align: right; font-weight: 500;">${params.nextBillingDate}</td>
            </tr>
            `
                : ""
            }
            ${
              params.amount
                ? `
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textSecondary};">New billing amount</td>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textPrimary}; text-align: right; font-weight: 500;">${params.amount} + tax</td>
            </tr>
            `
                : ""
            }
            ${
              params.companyName
                ? `
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textSecondary};">Company name</td>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textPrimary}; text-align: right; font-weight: 500;">${params.companyName}</td>
            </tr>
            `
                : ""
            }
            ${
              params.taxId
                ? `
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textSecondary};">Tax ID</td>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textPrimary}; text-align: right; font-weight: 500;">${params.taxId}</td>
            </tr>
            `
                : ""
            }
            ${
              params.billingAddress
                ? `
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textSecondary};">Billing address</td>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textPrimary}; text-align: right; font-weight: 500;">${params.billingAddress}</td>
            </tr>
            `
                : ""
            }
            ${
              params.phoneNumber
                ? `
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textSecondary};">Phone number</td>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textPrimary}; text-align: right; font-weight: 500;">${params.phoneNumber}</td>
            </tr>
            `
                : ""
            }
          </table>
        </td>
      </tr>
    </table>

    <!-- New Features -->
    <p style="margin: 25px 0 12px 0; font-size: 14px; font-weight: 600; color: ${baseStyles.textPrimary};">
      Your updated plan includes:
    </p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
      ${params.newFeatures
        .map(
          (feature) => `
        <tr>
          <td style="padding: 6px 0; font-size: 14px; line-height: 20px; color: ${baseStyles.textSecondary};">
            • ${feature}
          </td>
        </tr>
      `,
        )
        .join("")}
    </table>

    ${button(params.dashboardLink, "Manage Subscription")}
    ${divider()}
    <p style="margin: 0 0 8px 0; font-size: 13px; line-height: 20px; color: ${baseStyles.textSecondary};">
      Questions about your subscription or billing?
    </p>
    <p style="margin: 0; font-size: 13px; line-height: 20px; color: ${baseStyles.textSecondary};">
      Contact us at support@shortn.at
    </p>
  `;
  return emailWrapper(content);
};

/**
 * Subscription Cancelled Email Template
 */
export const subscriptionCancelledTemplate = (params: {
  userName: string;
  planName: string;
  endDate: string;
  dashboardLink: string;
  cancellationReason?: string;
  refundAmount?: string;
  billingEmail?: string;
  cardLast4?: string;
  cardBrand?: string;
  taxId?: string;
  companyName?: string;
  billingAddress?: string;
  phoneNumber?: string;
}) => {
  const content = `
    <h2 style="margin: 0 0 10px 0; font-size: 20px; font-weight: 600; color: ${baseStyles.textPrimary};">
      Subscription Cancelled
    </h2>
    <p style="margin: 0 0 25px 0; font-size: 13px; color: ${baseStyles.textSecondary};">
      ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
    </p>
    <p style="margin: 0 0 15px 0; font-size: 15px; line-height: 24px; color: ${baseStyles.textSecondary};">
      Hi ${params.userName},
    </p>
    <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 24px; color: ${baseStyles.textSecondary};">
      Your <strong>${params.planName}</strong> subscription has been cancelled as requested.
    </p>
    
    <!-- Cancellation Details -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 25px 0; border: 1px solid ${baseStyles.border}; border-radius: 6px;">
      <tr>
        <td style="padding: 20px; background-color: #fafbfc;">
          <p style="margin: 0 0 15px 0; font-size: 13px; font-weight: 600; color: ${baseStyles.textPrimary}; text-transform: uppercase; letter-spacing: 0.5px;">
            Cancellation Details
          </p>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textSecondary};">Plan</td>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textPrimary}; text-align: right; font-weight: 500;">${params.planName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textSecondary};">Access until</td>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textPrimary}; text-align: right; font-weight: 500;">${params.endDate}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textSecondary};">Status</td>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.danger}; text-align: right; font-weight: 500;">Cancelled</td>
            </tr>
            ${
              params.refundAmount
                ? `
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textSecondary};">Refund amount</td>
              <td style="padding: 8px 0; font-size: 14px; color: #10b981; text-align: right; font-weight: 500;">${params.refundAmount}</td>
            </tr>
            `
                : ""
            }
          </table>
        </td>
      </tr>
    </table>

    ${
      (params.cardBrand && params.cardLast4) || params.billingEmail
        ? `
    <!-- Account Information -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 25px 0; border: 1px solid ${baseStyles.border}; border-radius: 6px;">
      <tr>
        <td style="padding: 20px; background-color: #fafbfc;">
          <p style="margin: 0 0 15px 0; font-size: 13px; font-weight: 600; color: ${baseStyles.textPrimary}; text-transform: uppercase; letter-spacing: 0.5px;">
            Account Information
          </p>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            ${
              params.cardBrand && params.cardLast4
                ? `
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textSecondary};">Payment method</td>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textPrimary}; text-align: right; font-weight: 500;">${params.cardBrand} •••• ${params.cardLast4}</td>
            </tr>
            `
                : ""
            }
            ${
              params.billingEmail
                ? `
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textSecondary};">Account email</td>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textPrimary}; text-align: right; font-weight: 500;">${params.billingEmail}</td>
            </tr>
            `
                : ""
            }
            ${
              params.companyName
                ? `
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textSecondary};">Company name</td>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textPrimary}; text-align: right; font-weight: 500;">${params.companyName}</td>
            </tr>
            `
                : ""
            }
            ${
              params.taxId
                ? `
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textSecondary};">Tax ID</td>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textPrimary}; text-align: right; font-weight: 500;">${params.taxId}</td>
            </tr>
            `
                : ""
            }
            ${
              params.billingAddress
                ? `
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textSecondary};">Billing address</td>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textPrimary}; text-align: right; font-weight: 500;">${params.billingAddress}</td>
            </tr>
            `
                : ""
            }
            ${
              params.phoneNumber
                ? `
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textSecondary};">Phone number</td>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textPrimary}; text-align: right; font-weight: 500;">${params.phoneNumber}</td>
            </tr>
            `
                : ""
            }
          </table>
        </td>
      </tr>
    </table>
    `
        : ""
    }

    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 20px 0;">
      <tr>
        <td style="padding: 15px; background-color: #fffbeb; border-left: 3px solid #f59e0b; border-radius: 4px;">
          <p style="margin: 0; font-size: 14px; line-height: 20px; color: ${baseStyles.textSecondary};">
            You will retain access to your <strong>${params.planName}</strong> features until <strong>${params.endDate}</strong>. After this date, your account will automatically revert to the Free plan.
          </p>
        </td>
      </tr>
    </table>

    ${button(params.dashboardLink, "View Account")}
    ${divider()}
    <p style="margin: 0 0 10px 0; font-size: 13px; line-height: 20px; color: ${baseStyles.textSecondary};">
      Change of plans? You can reactivate your subscription anytime from your dashboard.
    </p>
    <p style="margin: 0; font-size: 13px; line-height: 20px; color: ${baseStyles.textSecondary};">
      Questions? Contact support@shortn.at
    </p>
  `;
  return emailWrapper(content);
};

/**
 * Payment Failed Email Template
 */
export const paymentFailedTemplate = (params: {
  userName: string;
  planName: string;
  retryDate: string;
  updatePaymentLink: string;
  amount?: string;
  failureReason?: string;
}) => {
  const content = `
    <h2 style="margin: 0 0 10px 0; font-size: 20px; font-weight: 600; color: ${baseStyles.textPrimary};">
      Payment Failed
    </h2>
    <p style="margin: 0 0 25px 0; font-size: 13px; color: ${baseStyles.textSecondary};">
      ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
    </p>
    <p style="margin: 0 0 15px 0; font-size: 15px; line-height: 24px; color: ${baseStyles.textSecondary};">
      Hi ${params.userName},
    </p>
    <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 24px; color: ${baseStyles.textSecondary};">
      We were unable to process your payment for your <strong>${params.planName}</strong> subscription.
    </p>
    
    <!-- Payment Failure Details -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 25px 0; border: 1px solid #fecaca; border-radius: 6px;">
      <tr>
        <td style="padding: 20px; background-color: #fff5f5;">
          <p style="margin: 0 0 15px 0; font-size: 13px; font-weight: 600; color: ${baseStyles.danger}; text-transform: uppercase; letter-spacing: 0.5px;">
            Payment Failed
          </p>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textSecondary};">Plan</td>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textPrimary}; text-align: right; font-weight: 500;">${params.planName}</td>
            </tr>
            ${
              params.amount
                ? `
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textSecondary};">Amount</td>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textPrimary}; text-align: right; font-weight: 500;">${params.amount}</td>
            </tr>
            `
                : ""
            }
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textSecondary};">Retry date</td>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textPrimary}; text-align: right; font-weight: 500;">${params.retryDate}</td>
            </tr>
            ${
              params.failureReason
                ? `
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textSecondary};">Reason</td>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.danger}; text-align: right; font-weight: 500;">${params.failureReason}</td>
            </tr>
            `
                : ""
            }
          </table>
        </td>
      </tr>
    </table>

    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 20px 0;">
      <tr>
        <td style="padding: 15px; background-color: #fffbeb; border-left: 3px solid #f59e0b; border-radius: 4px;">
          <p style="margin: 0; font-size: 14px; line-height: 20px; color: ${baseStyles.textSecondary};">
            To maintain uninterrupted access to your subscription, please update your payment method. We will automatically retry the payment on <strong>${params.retryDate}</strong>.
          </p>
        </td>
      </tr>
    </table>

    ${button(params.updatePaymentLink, "Update Payment Method")}
    ${divider()}
    <p style="margin: 0; font-size: 13px; line-height: 20px; color: ${baseStyles.textSecondary};">
      Need assistance? Contact support@shortn.at
    </p>
  `;
  return emailWrapper(content);
};

/**
 * Subscription Renewal Receipt Email Template
 * Sent when a recurring payment is successfully processed
 */
export const subscriptionRenewalTemplate = (params: {
  userName: string;
  planName: string;
  dashboardLink: string;
  amount: string;
  subtotal?: string;
  discount?: {
    name: string;
    code?: string;
    amount: string;
    percentOff?: number;
  };
  tax?: string;
  total: string;
  nextBillingDate?: string;
  billingPeriod?: string;
  cardLast4?: string;
  cardBrand?: string;
  billingEmail?: string;
  invoiceNumber?: string;
  invoicePdfUrl?: string;
  transactionDate?: string;
  taxId?: string;
  companyName?: string;
  billingAddress?: string;
  phoneNumber?: string;
}) => {
  const content = `
    <h2 style="margin: 0 0 10px 0; font-size: 20px; font-weight: 600; color: ${baseStyles.textPrimary};">
      Payment Receipt
    </h2>
    <p style="margin: 0 0 5px 0; font-size: 13px; color: ${baseStyles.textSecondary};">
      ${params.transactionDate || new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
    </p>
    ${
      params.invoiceNumber
        ? `
    <p style="margin: 0 0 25px 0; font-size: 13px; color: ${baseStyles.textSecondary};">
      Invoice #${params.invoiceNumber}
    </p>
    `
        : '<p style="margin: 0 0 25px 0;"></p>'
    }
    
    <p style="margin: 0 0 15px 0; font-size: 15px; line-height: 24px; color: ${baseStyles.textSecondary};">
      Hi ${params.userName},
    </p>
    <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 24px; color: ${baseStyles.textSecondary};">
      Thank you for your continued subscription. Your <strong>${params.planName}</strong> has been successfully renewed.
    </p>
    
    <!-- Payment Summary -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 25px 0; border: 1px solid ${baseStyles.border}; border-radius: 6px;">
      <tr>
        <td style="padding: 20px; background-color: #fafbfc;">
          <p style="margin: 0 0 15px 0; font-size: 13px; font-weight: 600; color: ${baseStyles.textPrimary}; text-transform: uppercase; letter-spacing: 0.5px;">
            Payment Summary
          </p>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textSecondary};">Description</td>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textPrimary}; text-align: right; font-weight: 500;">${params.planName}${params.billingPeriod ? ` - ${params.billingPeriod}` : ""}</td>
            </tr>
            ${
              params.subtotal
                ? `
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textSecondary};">Subtotal</td>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textPrimary}; text-align: right;">${params.subtotal}</td>
            </tr>
            `
                : ""
            }
            ${
              params.discount
                ? `
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textSecondary};">
                Discount${params.discount.code ? ` (${params.discount.code})` : ""}${params.discount.percentOff ? ` - ${params.discount.percentOff}% off` : ""}
              </td>
              <td style="padding: 8px 0; font-size: 14px; color: #10b981; text-align: right;">-${params.discount.amount}</td>
            </tr>
            `
                : ""
            }
            ${
              params.tax
                ? `
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textSecondary};">Tax</td>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textPrimary}; text-align: right;">${params.tax}</td>
            </tr>
            `
                : ""
            }
            <tr style="border-top: 1px solid ${baseStyles.border};">
              <td style="padding: 12px 0 8px 0; font-size: 15px; color: ${baseStyles.textPrimary}; font-weight: 600;">Total</td>
              <td style="padding: 12px 0 8px 0; font-size: 15px; color: ${baseStyles.textPrimary}; text-align: right; font-weight: 600;">${params.total}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Billing Information -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 25px 0; border: 1px solid ${baseStyles.border}; border-radius: 6px;">
      <tr>
        <td style="padding: 20px; background-color: #fafbfc;">
          <p style="margin: 0 0 15px 0; font-size: 13px; font-weight: 600; color: ${baseStyles.textPrimary}; text-transform: uppercase; letter-spacing: 0.5px;">
            Billing Information
          </p>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            ${
              params.cardBrand && params.cardLast4
                ? `
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textSecondary};">Payment method</td>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textPrimary}; text-align: right; font-weight: 500;">${params.cardBrand} •••• ${params.cardLast4}</td>
            </tr>
            `
                : ""
            }
            ${
              params.billingEmail
                ? `
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textSecondary};">Billing email</td>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textPrimary}; text-align: right; font-weight: 500;">${params.billingEmail}</td>
            </tr>
            `
                : ""
            }
            ${
              params.nextBillingDate
                ? `
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textSecondary};">Next billing date</td>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textPrimary}; text-align: right; font-weight: 500;">${params.nextBillingDate}</td>
            </tr>
            `
                : ""
            }
            ${
              params.amount
                ? `
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textSecondary};">Billing amount</td>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textPrimary}; text-align: right; font-weight: 500;">${params.amount}</td>
            </tr>
            `
                : ""
            }
            ${
              params.companyName
                ? `
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textSecondary};">Company name</td>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textPrimary}; text-align: right; font-weight: 500;">${params.companyName}</td>
            </tr>
            `
                : ""
            }
            ${
              params.taxId
                ? `
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textSecondary};">Tax ID</td>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textPrimary}; text-align: right; font-weight: 500;">${params.taxId}</td>
            </tr>
            `
                : ""
            }
            ${
              params.billingAddress
                ? `
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textSecondary};">Billing address</td>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textPrimary}; text-align: right; font-weight: 500;">${params.billingAddress}</td>
            </tr>
            `
                : ""
            }
          </table>
        </td>
      </tr>
    </table>

    ${
      params.invoicePdfUrl
        ? `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin: 20px 0;">
      <tr>
        <td>
          <a href="${params.invoicePdfUrl}" target="_blank" style="font-size: 14px; color: ${baseStyles.primary}; text-decoration: underline;">
            Download Invoice PDF
          </a>
        </td>
      </tr>
    </table>
    `
        : ""
    }

    ${button(params.dashboardLink, "View Subscription")}
    ${divider()}
    <p style="margin: 0; font-size: 13px; line-height: 20px; color: ${baseStyles.textSecondary};">
      Questions about your subscription? Contact support@shortn.at
    </p>
  `;
  return emailWrapper(content);
};

/**
 * Trial Ending Soon Email Template
 */
export const trialEndingTemplate = (params: {
  userName: string;
  planName: string;
  trialEndDate: string;
  daysRemaining: number;
  dashboardLink: string;
  features: string[];
  amount?: string;
}) => {
  const content = `
    <h2 style="margin: 0 0 10px 0; font-size: 20px; font-weight: 600; color: ${baseStyles.textPrimary};">
      Your Trial Ends Soon
    </h2>
    <p style="margin: 0 0 25px 0; font-size: 13px; color: ${baseStyles.textSecondary};">
      ${params.daysRemaining} day${params.daysRemaining !== 1 ? "s" : ""} remaining
    </p>
    <p style="margin: 0 0 15px 0; font-size: 15px; line-height: 24px; color: ${baseStyles.textSecondary};">
      Hi ${params.userName},
    </p>
    <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 24px; color: ${baseStyles.textSecondary};">
      Your free trial of <strong>${params.planName}</strong> will end on <strong>${params.trialEndDate}</strong>. 
      ${params.amount ? `After your trial, you'll be charged ${params.amount}.` : ""}
    </p>
    
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 20px 0;">
      <tr>
        <td style="padding: 15px; background-color: #fffbeb; border-left: 3px solid #f59e0b; border-radius: 4px;">
          <p style="margin: 0; font-size: 14px; line-height: 20px; color: ${baseStyles.textSecondary};">
            To continue enjoying your ${params.planName} features without interruption, make sure your payment method is up to date.
          </p>
        </td>
      </tr>
    </table>

    <!-- Features you'll keep -->
    <p style="margin: 25px 0 12px 0; font-size: 14px; font-weight: 600; color: ${baseStyles.textPrimary};">
      What you'll keep with ${params.planName}:
    </p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
      ${params.features
        .map(
          (feature) => `
        <tr>
          <td style="padding: 6px 0; font-size: 14px; line-height: 20px; color: ${baseStyles.textSecondary};">
            ✓ ${feature}
          </td>
        </tr>
      `,
        )
        .join("")}
    </table>

    ${button(params.dashboardLink, "Manage Subscription")}
    ${divider()}
    <p style="margin: 0; font-size: 13px; line-height: 20px; color: ${baseStyles.textSecondary};">
      Questions? Contact support@shortn.at
    </p>
  `;
  return emailWrapper(content);
};

/**
 * Trial Ended Email Template
 */
export const trialEndedTemplate = (params: {
  userName: string;
  planName: string;
  dashboardLink: string;
  wasConverted: boolean;
  newPlan?: string;
}) => {
  const content = params.wasConverted
    ? `
    <h2 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 600; color: ${baseStyles.textPrimary};">
      Your Trial Has Ended
    </h2>
    <p style="margin: 0 0 15px 0; font-size: 15px; line-height: 24px; color: ${baseStyles.textSecondary};">
      Hi ${params.userName},
    </p>
    <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 24px; color: ${baseStyles.textSecondary};">
      Your free trial of <strong>${params.planName}</strong> has ended and your subscription is now active. 
      Thank you for continuing with Shortn!
    </p>
    
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 20px 0;">
      <tr>
        <td style="padding: 15px; background-color: #f0fdf4; border-left: 3px solid ${baseStyles.success}; border-radius: 4px;">
          <p style="margin: 0; font-size: 14px; line-height: 20px; color: ${baseStyles.textSecondary};">
            Your ${params.newPlan || params.planName} subscription is now active. You'll receive a receipt for your first payment shortly.
          </p>
        </td>
      </tr>
    </table>

    ${button(params.dashboardLink, "Go to Dashboard")}
  `
    : `
    <h2 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 600; color: ${baseStyles.textPrimary};">
      Your Trial Has Ended
    </h2>
    <p style="margin: 0 0 15px 0; font-size: 15px; line-height: 24px; color: ${baseStyles.textSecondary};">
      Hi ${params.userName},
    </p>
    <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 24px; color: ${baseStyles.textSecondary};">
      Your free trial of <strong>${params.planName}</strong> has ended. Your account has been moved to our Free plan.
    </p>
    
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 20px 0;">
      <tr>
        <td style="padding: 15px; background-color: #f7fafc; border-left: 3px solid ${baseStyles.border}; border-radius: 4px;">
          <p style="margin: 0; font-size: 14px; line-height: 20px; color: ${baseStyles.textSecondary};">
            You can still use Shortn with our Free plan features. Upgrade anytime to unlock more capabilities.
          </p>
        </td>
      </tr>
    </table>

    ${button(params.dashboardLink, "Upgrade Now")}
  `;
  return emailWrapper(
    content +
      `
    ${divider()}
    <p style="margin: 0; font-size: 13px; line-height: 20px; color: ${baseStyles.textSecondary};">
      Questions? Contact support@shortn.at
    </p>
  `,
  );
};

/**
 * Refund Processed Email Template
 */
export const refundProcessedTemplate = (params: {
  userName: string;
  refundAmount: string;
  refundReason?: string;
  originalAmount?: string;
  planName?: string;
  refundDate?: string;
  cardLast4?: string;
  cardBrand?: string;
  dashboardLink: string;
}) => {
  const content = `
    <h2 style="margin: 0 0 10px 0; font-size: 20px; font-weight: 600; color: ${baseStyles.textPrimary};">
      Refund Processed
    </h2>
    <p style="margin: 0 0 25px 0; font-size: 13px; color: ${baseStyles.textSecondary};">
      ${params.refundDate || new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
    </p>
    <p style="margin: 0 0 15px 0; font-size: 15px; line-height: 24px; color: ${baseStyles.textSecondary};">
      Hi ${params.userName},
    </p>
    <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 24px; color: ${baseStyles.textSecondary};">
      We've processed a refund for your account. The details are below.
    </p>
    
    <!-- Refund Details -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 25px 0; border: 1px solid ${baseStyles.border}; border-radius: 6px;">
      <tr>
        <td style="padding: 20px; background-color: #f0fdf4;">
          <p style="margin: 0 0 15px 0; font-size: 13px; font-weight: 600; color: ${baseStyles.success}; text-transform: uppercase; letter-spacing: 0.5px;">
            Refund Details
          </p>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textSecondary};">Refund amount</td>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.success}; text-align: right; font-weight: 600;">${params.refundAmount}</td>
            </tr>
            ${
              params.originalAmount
                ? `
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textSecondary};">Original payment</td>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textPrimary}; text-align: right; font-weight: 500;">${params.originalAmount}</td>
            </tr>
            `
                : ""
            }
            ${
              params.planName
                ? `
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textSecondary};">Plan</td>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textPrimary}; text-align: right; font-weight: 500;">${params.planName}</td>
            </tr>
            `
                : ""
            }
            ${
              params.cardBrand && params.cardLast4
                ? `
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textSecondary};">Refund to</td>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textPrimary}; text-align: right; font-weight: 500;">${params.cardBrand} •••• ${params.cardLast4}</td>
            </tr>
            `
                : ""
            }
            ${
              params.refundReason
                ? `
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textSecondary};">Reason</td>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textPrimary}; text-align: right; font-weight: 500;">${params.refundReason}</td>
            </tr>
            `
                : ""
            }
          </table>
        </td>
      </tr>
    </table>

    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 20px 0;">
      <tr>
        <td style="padding: 15px; background-color: #f7fafc; border-left: 3px solid ${baseStyles.border}; border-radius: 4px;">
          <p style="margin: 0; font-size: 14px; line-height: 20px; color: ${baseStyles.textSecondary};">
            Please allow 5-10 business days for the refund to appear on your statement, depending on your bank.
          </p>
        </td>
      </tr>
    </table>

    ${button(params.dashboardLink, "View Account")}
    ${divider()}
    <p style="margin: 0; font-size: 13px; line-height: 20px; color: ${baseStyles.textSecondary};">
      Questions? Contact support@shortn.at
    </p>
  `;
  return emailWrapper(content);
};

/**
 * Subscription Downgrade Email Template
 * Sent when a user downgrades their plan
 */
export const subscriptionDowngradedTemplate = (params: {
  userName: string;
  oldPlan: string;
  newPlan: string;
  dashboardLink: string;
  effectiveDate: string;
  newFeatures: string[];
  lostFeatures?: string[];
  newAmount?: string;
  billingPeriod?: string;
  cardLast4?: string;
  cardBrand?: string;
  billingEmail?: string;
}) => {
  const content = `
    <h2 style="margin: 0 0 10px 0; font-size: 20px; font-weight: 600; color: ${baseStyles.textPrimary};">
      Subscription Downgraded
    </h2>
    <p style="margin: 0 0 25px 0; font-size: 13px; color: ${baseStyles.textSecondary};">
      ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
    </p>
    <p style="margin: 0 0 15px 0; font-size: 15px; line-height: 24px; color: ${baseStyles.textSecondary};">
      Hi ${params.userName},
    </p>
    <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 24px; color: ${baseStyles.textSecondary};">
      Your subscription has been changed from <strong>${params.oldPlan}</strong> to <strong>${params.newPlan}</strong>.
    </p>
    
    <!-- Plan Change Details -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 25px 0; border: 1px solid ${baseStyles.border}; border-radius: 6px;">
      <tr>
        <td style="padding: 20px; background-color: #fafbfc;">
          <p style="margin: 0 0 15px 0; font-size: 13px; font-weight: 600; color: ${baseStyles.textPrimary}; text-transform: uppercase; letter-spacing: 0.5px;">
            Plan Change
          </p>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textSecondary};">Previous plan</td>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textSecondary}; text-align: right; text-decoration: line-through;">${params.oldPlan}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textSecondary};">New plan</td>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textPrimary}; text-align: right; font-weight: 500;">${params.newPlan}${params.billingPeriod ? ` - ${params.billingPeriod}` : ""}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textSecondary};">Effective date</td>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textPrimary}; text-align: right; font-weight: 500;">${params.effectiveDate}</td>
            </tr>
            ${
              params.newAmount
                ? `
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textSecondary};">New billing amount</td>
              <td style="padding: 8px 0; font-size: 14px; color: ${baseStyles.textPrimary}; text-align: right; font-weight: 500;">${params.newAmount}</td>
            </tr>
            `
                : ""
            }
          </table>
        </td>
      </tr>
    </table>

    ${
      params.lostFeatures && params.lostFeatures.length > 0
        ? `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 20px 0;">
      <tr>
        <td style="padding: 15px; background-color: #fffbeb; border-left: 3px solid #f59e0b; border-radius: 4px;">
          <p style="margin: 0 0 10px 0; font-size: 14px; font-weight: 600; color: ${baseStyles.textPrimary};">
            Features no longer available:
          </p>
          <ul style="margin: 0; padding-left: 20px;">
            ${params.lostFeatures.map((f) => `<li style="margin: 5px 0; font-size: 13px; color: ${baseStyles.textSecondary};">${f}</li>`).join("")}
          </ul>
        </td>
      </tr>
    </table>
    `
        : ""
    }

    <!-- New Plan Features -->
    <p style="margin: 25px 0 12px 0; font-size: 14px; font-weight: 600; color: ${baseStyles.textPrimary};">
      Your ${params.newPlan} includes:
    </p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
      ${params.newFeatures
        .map(
          (feature) => `
        <tr>
          <td style="padding: 6px 0; font-size: 14px; line-height: 20px; color: ${baseStyles.textSecondary};">
            • ${feature}
          </td>
        </tr>
      `,
        )
        .join("")}
    </table>

    ${button(params.dashboardLink, "Manage Subscription")}
    ${divider()}
    <p style="margin: 0 0 8px 0; font-size: 13px; line-height: 20px; color: ${baseStyles.textSecondary};">
      Changed your mind? You can upgrade anytime from your dashboard.
    </p>
    <p style="margin: 0; font-size: 13px; line-height: 20px; color: ${baseStyles.textSecondary};">
      Questions? Contact support@shortn.at
    </p>
  `;
  return emailWrapper(content);
};
