import { Body, Button, Head, Html, Preview } from "@react-email/components";
import { Fragment, type CSSProperties, type ReactNode } from "react";
import { messages, type Locale } from "./messages";

// Hex approximations of the DESIGN.md tokens: mail clients don't parse oklch.
export const palette = {
  ink: "#0f172b",
  muted: "#505869",
  subtle: "#686f7e",
  line: "#e3e6ed",
  panel: "#f4f6f9",
  signal: "#2c67dc",
  bg: "#ffffff",
  onInk: "#ffffff",
};

const fonts = {
  sans: "Geist, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  display:
    "'Schibsted Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  mono: "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
};

const htmlLang: Record<Locale, string> = { en: "en", pt: "pt-PT", es: "es" };

const siteUrl = "https://shortn.at";

function Block({
  padding,
  style,
  children,
}: {
  padding: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <table
      role="presentation"
      width="100%"
      cellPadding={0}
      cellSpacing={0}
      border={0}
    >
      <tbody>
        <tr>
          <td style={{ padding, ...style }}>{children}</td>
        </tr>
      </tbody>
    </table>
  );
}

function Brand() {
  return (
    <table
      role="presentation"
      cellPadding={0}
      cellSpacing={0}
      border={0}
      data-skip-in-text="true"
    >
      <tbody>
        <tr>
          <td
            width={26}
            height={26}
            align="center"
            valign="middle"
            style={{
              backgroundColor: palette.ink,
              borderRadius: 4,
              color: palette.onInk,
              fontFamily: fonts.display,
              fontSize: 23,
              fontWeight: 900,
              height: 26,
              lineHeight: "26px",
              textAlign: "center",
              width: 26,
            }}
          >
            S
          </td>
          <td
            style={{
              color: palette.ink,
              fontFamily: fonts.display,
              fontSize: 19,
              fontWeight: 800,
              letterSpacing: "-0.4px",
              lineHeight: "26px",
              paddingLeft: 10,
            }}
          >
            Shortn
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function Footer({ locale, reason }: { locale: Locale; reason: string }) {
  const text: CSSProperties = {
    color: palette.subtle,
    fontSize: 12,
    lineHeight: "18px",
    margin: 0,
  };
  return (
    <Block padding="16px 0 0">
      <Block
        padding="24px 0 0"
        style={{ borderTop: `1px solid ${palette.line}` }}
      >
        <p style={text}>{reason}</p>
        <p style={{ ...text, marginTop: 6 }}>
          Shortn · {messages[locale].footer.madeIn} ·{" "}
          <a href={siteUrl} className="site" style={{ color: palette.subtle }}>
            shortn.at
          </a>
        </p>
      </Block>
    </Block>
  );
}

/**
 * `footer` is the localized reason the recipient got this email; the brand
 * line under it is added here.
 */
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
    <Html lang={htmlLang[locale]}>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
        <meta
          name="format-detection"
          content="telephone=no, date=no, address=no, email=no, url=no"
        />
        <style>
          {":root{color-scheme:light;supported-color-schemes:light}"}
        </style>
      </Head>
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: palette.bg,
          color: palette.ink,
          fontFamily: fonts.sans,
          margin: 0,
          padding: 0,
        }}
      >
        <table
          role="presentation"
          align="center"
          width="100%"
          cellPadding={0}
          cellSpacing={0}
          border={0}
          style={{ maxWidth: 560 }}
        >
          <tbody>
            <tr>
              <td style={{ padding: "40px 24px 48px" }}>
                <Brand />
                <Block padding="40px 0 0">
                  {children}
                  <Footer locale={locale} reason={footer} />
                </Block>
              </td>
            </tr>
          </tbody>
        </table>
      </Body>
    </Html>
  );
}

export function Heading({ children }: { children: ReactNode }) {
  return (
    <h1
      style={{
        color: palette.ink,
        fontFamily: fonts.display,
        fontSize: 32,
        fontWeight: 800,
        letterSpacing: "-1px",
        lineHeight: "36px",
        margin: "0 0 16px",
      }}
    >
      {children}
    </h1>
  );
}

export function Paragraph({ children }: { children: ReactNode }) {
  return (
    <p
      style={{
        color: palette.ink,
        fontSize: 16,
        lineHeight: "26px",
        margin: "0 0 16px",
      }}
    >
      {children}
    </p>
  );
}

const mutedText: CSSProperties = {
  color: palette.muted,
  fontSize: 14,
  lineHeight: "22px",
  margin: "0 0 12px",
};

export function Muted({ children }: { children: ReactNode }) {
  return <p style={mutedText}>{children}</p>;
}

export function Action({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Block padding="12px 0 28px">
      <Button
        href={href}
        style={{
          backgroundColor: palette.ink,
          borderRadius: 6,
          color: palette.onInk,
          display: "inline-block",
          fontFamily: fonts.sans,
          fontSize: 15,
          fontWeight: 600,
          lineHeight: "20px",
          padding: "12px 20px",
          textAlign: "center",
          textDecoration: "none",
        }}
      >
        {children}
      </Button>
    </Block>
  );
}

// The button already prints its URL in the plain-text part.
export function FallbackLink({ label, href }: { label: string; href: string }) {
  return (
    <p style={mutedText} data-skip-in-text="true">
      {label}{" "}
      <a href={href} style={{ color: palette.signal, wordBreak: "break-all" }}>
        {href}
      </a>
    </p>
  );
}

/** Light grey surface for structured data only: rows, codes, key/values. */
export function Panel({ children }: { children: ReactNode }) {
  return (
    <Block padding="8px 0 24px">
      <Block
        padding="4px 20px"
        style={{ backgroundColor: palette.panel, borderRadius: 8 }}
      >
        {children}
      </Block>
    </Block>
  );
}

export interface Detail {
  label: string;
  value: ReactNode;
  mono?: boolean;
  /** Puts the value under its label, for long values such as URLs. */
  wide?: boolean;
}

export function DetailRows({ rows }: { rows: readonly Detail[] }) {
  return (
    <table
      role="presentation"
      className="details"
      width="100%"
      cellPadding={0}
      cellSpacing={0}
      border={0}
    >
      <tbody>
        {rows.map((row, index) => {
          const cell: CSSProperties = {
            borderTop: index === 0 ? "none" : `1px solid ${palette.line}`,
            fontSize: 14,
            lineHeight: "20px",
            padding: "12px 0",
            verticalAlign: "top",
          };
          const value: CSSProperties = {
            color: palette.ink,
            fontFamily: row.mono ? fonts.mono : fonts.sans,
            fontSize: row.mono ? 13 : 14,
            fontVariantNumeric: "tabular-nums",
            fontWeight: 500,
            overflowWrap: "anywhere",
            wordBreak: row.mono ? "break-all" : "break-word",
          };
          return row.wide ? (
            <tr key={row.label}>
              <td colSpan={2} style={cell}>
                <div style={{ color: palette.muted }}>{row.label}</div>
                <div style={{ ...value, marginTop: 2 }}>{row.value}</div>
              </td>
            </tr>
          ) : (
            <tr key={row.label}>
              <td
                width="40%"
                style={{ ...cell, color: palette.muted, paddingRight: 16 }}
              >
                {row.label}
              </td>
              <td
                align="right"
                style={{ ...cell, ...value, textAlign: "right" }}
              >
                {row.value}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** A reference or one-time value the reader may need to copy or quote. */
export function Code({
  label,
  children,
}: {
  label?: string;
  children: string;
}) {
  return (
    <Panel>
      {label ? (
        <p
          style={{
            color: palette.muted,
            fontSize: 13,
            lineHeight: "18px",
            margin: "12px 0 4px",
          }}
        >
          {label}
        </p>
      ) : null}
      <p
        style={{
          color: palette.ink,
          fontFamily: fonts.mono,
          fontSize: 20,
          fontWeight: 600,
          letterSpacing: "0.5px",
          lineHeight: "28px",
          margin: label ? "0 0 12px" : "12px 0",
          wordBreak: "break-all",
        }}
      >
        {children}
      </p>
    </Panel>
  );
}

/** Hairline-separated items: a bold lead line with a short explanation. */
export function List({
  items,
}: {
  items: readonly { title: string; body: string }[];
}) {
  return (
    <Block padding="8px 0 24px">
      <table
        role="presentation"
        width="100%"
        cellPadding={0}
        cellSpacing={0}
        border={0}
      >
        <tbody>
          {items.map((item, index) => (
            <tr key={item.title}>
              <td
                style={{
                  borderBottom:
                    index === items.length - 1
                      ? `1px solid ${palette.line}`
                      : "none",
                  borderTop: `1px solid ${palette.line}`,
                  padding: "14px 0",
                }}
              >
                <p
                  style={{
                    color: palette.ink,
                    fontSize: 16,
                    fontWeight: 600,
                    lineHeight: "24px",
                    margin: 0,
                  }}
                >
                  {item.title}
                </p>
                <p
                  style={{
                    color: palette.muted,
                    fontSize: 15,
                    lineHeight: "22px",
                    margin: "2px 0 0",
                  }}
                >
                  {item.body}
                </p>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Block>
  );
}

/** Text the reader wrote, echoed back with its line breaks intact. */
export function Quote({
  label,
  children,
}: {
  label: string;
  children: string;
}) {
  return (
    <Block padding="8px 0 24px">
      <p
        style={{
          color: palette.muted,
          fontSize: 13,
          lineHeight: "18px",
          margin: "0 0 8px",
        }}
      >
        {label}
      </p>
      <Block
        padding="2px 0 2px 16px"
        style={{ borderLeft: `2px solid ${palette.line}` }}
      >
        <p
          style={{
            color: palette.ink,
            fontSize: 15,
            lineHeight: "24px",
            margin: 0,
            overflowWrap: "anywhere",
          }}
        >
          {children.split(/\r?\n/).map((line, index) => (
            <Fragment key={index}>
              {index > 0 ? <br /> : null}
              {line}
            </Fragment>
          ))}
        </p>
      </Block>
    </Block>
  );
}
