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
  Tailwind,
  Text,
} from "@react-email/components";

export function VerifyReactEmail({
  verificationLink,
}: {
  verificationLink: string;
}) {
  return (
    <Html>
      <Head />
      <Preview>Verify you Shortn.at account</Preview>
      <Tailwind
        config={{
          darkMode: "class",
          theme: {
            extend: {
              fontFamily: {
                sans: ["var(--font-sans)"],
              },
              colors: {
                brand: "#0a0a0a",
                muted: "#fafafa",
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                card: {
                  DEFAULT: "hsl(var(--card))",
                  foreground: "hsl(var(--card-foreground))",
                },
                popover: {
                  DEFAULT: "hsl(var(--popover))",
                  foreground: "hsl(var(--popover-foreground))",
                },
                primary: {
                  DEFAULT: "hsl(var(--primary))",
                  foreground: "hsl(var(--primary-foreground))",
                },
                secondary: {
                  DEFAULT: "hsl(var(--secondary))",
                  foreground: "hsl(var(--secondary-foreground))",
                },
                accent: {
                  DEFAULT: "hsl(var(--accent))",
                  foreground: "hsl(var(--accent-foreground))",
                },
                destructive: {
                  DEFAULT: "hsl(var(--destructive))",
                  foreground: "hsl(var(--destructive-foreground))",
                },
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                chart: {
                  "1": "hsl(var(--chart-1))",
                  "2": "hsl(var(--chart-2))",
                  "3": "hsl(var(--chart-3))",
                  "4": "hsl(var(--chart-4))",
                  "5": "hsl(var(--chart-5))",
                },
              },
              borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 3.5px)",
                sm: "calc(var(--radius) - 4px)",
              },
            },
          },
        }}
      >
        <Body className="font-sans bg-white text-[#212121]">
          <Container className="mx-auto px-4 py-5">
            <Section className="mt-8">
              <svg
                version="1.0"
                xmlns="http://www.w3.org/2000/svg"
                width="504.000000pt"
                height="507.000000pt"
                viewBox="0 0 504.000000 507.000000"
                preserveAspectRatio="xMidYMid meet"
              >
                <g
                  transform="translate(0.000000,507.000000) scale(0.100000,-0.100000)"
                  fill="#222731"
                  stroke="none"
                >
                  <path
                    d="M0 2535 l0 -2535 2520 0 2520 0 0 2535 0 2535 -2520 0 -2520 0 0
-2535z m2802 1850 c207 -26 310 -55 508 -140 168 -73 343 -212 453 -360 73
-99 96 -144 135 -270 41 -130 52 -204 52 -348 l0 -117 -26 -11 c-36 -13 -979
-8 -993 6 -5 6 -14 53 -20 106 -22 217 -120 320 -339 352 -137 21 -355 -35
-436 -111 -44 -42 -76 -124 -76 -196 0 -57 4 -68 43 -126 35 -53 56 -72 127
-114 89 -54 218 -115 285 -136 22 -7 92 -33 155 -58 63 -24 165 -62 225 -82
128 -44 413 -171 500 -223 33 -20 79 -46 103 -58 67 -36 207 -158 278 -243 35
-43 77 -107 95 -144 17 -37 36 -76 41 -86 6 -11 22 -60 36 -110 21 -77 26
-118 30 -263 4 -161 2 -178 -23 -279 -78 -310 -263 -529 -576 -681 -160 -77
-233 -101 -427 -138 -227 -44 -542 -54 -747 -25 -95 14 -294 58 -360 79 -86
27 -276 123 -354 178 -102 71 -238 215 -302 319 -91 145 -144 342 -156 572 -5
109 -4 124 12 142 18 19 31 20 505 20 374 0 490 -3 502 -13 11 -8 17 -37 22
-97 11 -155 48 -246 128 -315 87 -75 155 -95 326 -95 203 0 332 42 402 131 38
46 50 127 30 198 -22 82 -143 181 -330 268 -179 85 -223 103 -275 118 -45 12
-135 43 -415 143 -117 42 -358 174 -455 249 -111 85 -202 182 -271 288 -114
176 -147 300 -148 560 0 208 22 334 80 448 65 128 223 311 333 385 30 21 73
50 95 65 23 15 50 32 61 37 269 119 358 146 565 174 145 19 449 20 602 1z"
                  />
                </g>
              </svg>
            </Section>

            <Section className="mt-8">
              <Text className="text-xl font-bold leading-tight">
                Verify your email address
              </Text>
            </Section>

            <Section className="mt-2">
              <Text className="text-base">
                Thanks for signing up for Shortn.at! We need to verify your
                email address to complete your account setup. Please click the
                button bellow to verify your email address. If you didn&apos;t
                create an account, you can safely ignore this message.
              </Text>
            </Section>

            <Section className="mt-4 text-center">
              <Container className="mx-auto flex w-full flex-col items-center justify-center px-4 py-5">
                <Button
                  href={verificationLink}
                  className="mx-auto flex w-fit items-center justify-center rounded-[32px] bg-[#020618] px-[24px] py-[12px] text-center text-[14px] font-semibold text-[#ffffff]"
                >
                  Verify your account.
                </Button>
              </Container>
              <Text className="text-[#666] text-[12px] mt-4 mb-0 text-left">
                Or copy and paste this link in your browser:
              </Text>
              <Link
                href={verificationLink}
                className="text-[#2754C5] text-[12px] break-all mt-2 text-left"
              >
                {verificationLink}
              </Link>
            </Section>

            <Hr className="mb-6 mt-8 border-gray-200" />

            <Section className="mb-4 text-left text-sm text-primary/80">
              <Text className="text-[#333] text-[12px] my-[24px] m-0 p-0">
                This message was sent by Shortn.at. © 2025 Shortn.at. All
                rights reserved. View our{" "}
                <Link
                  href="https://shortn.at/privacy"
                  target="_blank"
                  className="text-[#2754C5] underline text-[14px]"
                >
                  privacy policy
                </Link>{" "}
                and{" "}
                <Link
                  href="https://shortn.at/terms"
                  target="_blank"
                  className="text-[#2754C5] underline text-[14px]"
                >
                  terms of service
                </Link>
                .
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
