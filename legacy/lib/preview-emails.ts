/**
 * Email Template Preview Generator
 *
 * This file generates HTML files for previewing email templates in a browser.
 * Run this file with: bun run lib/preview-emails.ts
 */

import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import {
  verificationEmailTemplate,
  welcomeEmailTemplate,
  resetPasswordEmailTemplate,
  updateEmailVerificationTemplate,
  emailVerifiedTemplate,
  confirmEmailChangeTemplate,
} from "./email-templates";

const previewDir = join(process.cwd(), "email-previews");

// Create preview directory if it doesn't exist
try {
  mkdirSync(previewDir, { recursive: true });
} catch (_error) {
  // Directory already exists
}

// Sample data for previews
const sampleData = {
  userName: "John Doe",
  userEmail: "john@example.com",
  newEmail: "john.new@example.com",
  verificationLink: "https://shortn.at/verify?token=sample-token-123",
  resetLink: "https://shortn.at/reset-password?token=sample-token-456",
  dashboardLink: "https://shortn.at/dashboard",
  confirmLink: "https://shortn.at/confirm-change?token=sample-token-789",
};

// Generate previews
const templates = [
  {
    name: "verification-email",
    html: verificationEmailTemplate({
      verificationLink: sampleData.verificationLink,
      userName: sampleData.userName,
    }),
  },
  {
    name: "welcome-email",
    html: welcomeEmailTemplate({
      userName: sampleData.userName,
      dashboardLink: sampleData.dashboardLink,
    }),
  },
  {
    name: "reset-password-email",
    html: resetPasswordEmailTemplate({
      resetLink: sampleData.resetLink,
      expiryMinutes: 10,
    }),
  },
  {
    name: "update-email-verification",
    html: updateEmailVerificationTemplate({
      verificationLink: sampleData.verificationLink,
      newEmail: sampleData.newEmail,
    }),
  },
  {
    name: "email-verified",
    html: emailVerifiedTemplate({
      userName: sampleData.userName,
      dashboardLink: sampleData.dashboardLink,
    }),
  },
  {
    name: "confirm-email-change",
    html: confirmEmailChangeTemplate({
      confirmLink: sampleData.confirmLink,
      userName: sampleData.userName,
      newEmail: sampleData.newEmail,
    }),
  },
];

// Write preview files
templates.forEach(({ name, html }) => {
  const filePath = join(previewDir, `${name}.html`);
  writeFileSync(filePath, html);
  console.log(`✓ Generated ${name}.html`);
});

console.log(`\n✨ All email previews generated in: ${previewDir}`);
console.log("Open any HTML file in your browser to preview the email.\n");
