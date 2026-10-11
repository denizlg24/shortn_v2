import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";
import type { Locale } from "./messages";

// Hex approximations of the UI tokens (12): mail clients don't parse oklch.
export const palette = {
  ink: "#0f172b",
  muted: "#5c6378",
  line: "#e2e5ec",
  signal: "#2a5bd7",
  bg: "#ffffff",
};

const font =
  "Geist, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

export function Layout({
  locale,
  preview,
  footer,
  children,
}: {
  locale: Locale;
  preview: string;
  footer: string;
  children: ReactNode;
}) {
  return (
    <Html lang={locale}>
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{ backgroundColor: palette.bg, fontFamily: font, margin: 0 }}
      >
        <Container style={{ maxWidth: 520, padding: "40px 24px" }}>
          <Text
            style={{
              color: palette.ink,
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: "-0.01em",
              margin: "0 0 32px",
            }}
          >
            Shortn
          </Text>
          {children}
          <Hr style={{ borderColor: palette.line, margin: "32px 0 16px" }} />
          <Text
            style={{
              color: palette.muted,
              fontSize: 12,
              lineHeight: "18px",
              margin: 0,
            }}
          >
            {footer}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export function Heading({ children }: { children: ReactNode }) {
  return (
    <Text
      style={{
        color: palette.ink,
        fontSize: 20,
        fontWeight: 600,
        lineHeight: "28px",
        margin: "0 0 12px",
      }}
    >
      {children}
    </Text>
  );
}

export function Paragraph({ children }: { children: ReactNode }) {
  return (
    <Text
      style={{
        color: palette.ink,
        fontSize: 14,
        lineHeight: "22px",
        margin: "0 0 16px",
      }}
    >
      {children}
    </Text>
  );
}

export function Muted({ children }: { children: ReactNode }) {
  return (
    <Text
      style={{
        color: palette.muted,
        fontSize: 13,
        lineHeight: "20px",
        margin: "0 0 12px",
      }}
    >
      {children}
    </Text>
  );
}

export function Action({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Section style={{ margin: "24px 0" }}>
      <Button
        href={href}
        style={{
          backgroundColor: palette.ink,
          borderRadius: 6,
          color: "#ffffff",
          display: "inline-block",
          fontSize: 14,
          fontWeight: 500,
          padding: "10px 16px",
          textDecoration: "none",
        }}
      >
        {children}
      </Button>
    </Section>
  );
}

export function FallbackLink({ label, href }: { label: string; href: string }) {
  return (
    <Muted>
      {label}{" "}
      <Link
        href={href}
        style={{ color: palette.signal, wordBreak: "break-all" }}
      >
        {href}
      </Link>
    </Muted>
  );
}
