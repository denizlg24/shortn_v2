import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Html,
  //Img,
  Link,
  Preview,
  Row,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";

export function ConfirmUpdateEmailRequest({
  link,
  userName,
  newEmail,
}: {
  link: string;
  userName: string;
  newEmail: string;
}) {
  return (
    <Html>
      <Preview>Shortn.at - Email Change Requested</Preview>
      <Tailwind
        config={{
          darkMode: "class",
          theme: {
            extend: {
              fontFamily: {
                sans: ["var(--font-sans)"],
              },
              colors: {
                brand: "#155dfc",

                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                primary: {
                  DEFAULT: "#314158",
                  foreground: "hsl(var(--primary-foreground))",
                },
                accent: {
                  DEFAULT: "#314158",
                  foreground: "hsl(var(--accent-foreground))",
                },
                muted: {
                  DEFAULT: "hsl(var(--muted))",
                  foreground: "hsl(var(--muted-foreground))",
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
                text: {
                  light: "#314158",
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
        <Head />
        <Body className="font-sans">
          <Container className="mx-auto mb-5 px-4 py-5">
            {/* <Section className="my-8">
              <Link href="https://shortn.at">
                <Img src="https://shortn.at/assets/favicon-96x96-c6fc0ab4.png" className="aspect-square w-[64px] cursor-pointer rounded-[2px] object-cover"/>
              </Link>
            </Section> */}

            <Section className="mb-6 flex flex-col items-center justify-center rounded-[12px] bg-[hsl(240,4.8%,95.9%)]/50">
              <table
                style={{
                  border: "1px solid rgb(39 39 42 / 0.1)",
                  borderRadius: "8px",
                  borderCollapse: "collapse",
                  display: "flex",
                  justifyContent: "center",
                  width: "fit-content",
                  alignItems: "center",
                  padding: "24px",
                }}
              >
                <tr>
                  <td>
                    <Section>
                      <table
                        cellPadding="0"
                        cellSpacing="0"
                        style={{ width: "100%" }}
                      >
                        <tr className="align-start flex items-center justify-start gap-[16px]">
                          {/* <td className="h-[40px] w-[40px] rounded-[8px]">
                            <Section
                              className="flex h-[40px] w-[40px] items-center justify-center rounded-[8px]"
                              style={{
                                backgroundColor: "hsl(151.8 81% 95.9%)",
                                borderRadius: "8px",
                                border: "1px solid hsl(149.3 80.4% 90%)",
                              }}
                            >
                              <svg
                                width="24"
                                height="24"
                                fill="none"
                                stroke="hsl(161.4 93.5% 30.4%)"
                                strokeWidth="2"
                                className="text-[hsl(161.4 93.5% 30.4%)]"
                                viewBox="0 0 24 24"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path d="M20.5 15.8V8.2a1.91 1.91 0 0 0-.944-1.645l-6.612-3.8a1.88 1.88 0 0 0-1.888 0l-6.612 3.8A1.9 1.9 0 0 0 3.5 8.2v7.602a1.91 1.91 0 0 0 .944 1.644l6.612 3.8a1.88 1.88 0 0 0 1.888 0l6.612-3.8A1.9 1.9 0 0 0 20.5 15.8" />
                                <path d="m8.667 12.633 1.505 1.721a1 1 0 0 0 1.564-.073L15.333 9.3" />
                              </svg>
                            </Section>
                          </td> */}

                          <td className="text-left">
                            <Text className="text-text-light m-0 p-0 text-lg font-bold leading-tight">
                              Confirmation Required!
                            </Text>
                          </td>
                        </tr>
                      </table>
                    </Section>
                    <Section>
                      <Text className="text-text-light m-0 mt-6 p-0 text-base">
                        Dear {userName},
                      </Text>
                      <Text className="text-text-light m-0 mt-4 p-0 text-base">
                        We received a request to change the email address
                        associated with your Shortn.at account to{" "}
                        <span className="text-sm text-brand">{newEmail}</span>.
                        If you did not initiate this change, you may safely
                        disregard this message.
                      </Text>
                    </Section>
                    <Section>
                      <Text className="text-text-light m-0 mt-4 p-0 text-base">
                        To proceed with this email change, please click the
                        button below to confirm your request.
                      </Text>
                    </Section>
                    <Section className="mt-4 text-center">
                      <table
                        style={{
                          display: "flex",
                          justifyContent: "center",
                          width: "fit-content",
                          alignItems: "center",
                        }}
                      >
                        <tr>
                          <td>
                            <Button
                              className="bg-brand mx-auto flex w-fit items-center justify-center rounded-[8px] px-[20px] py-[10px] text-center text-[14px] font-semibold text-muted"
                              href={link}
                            >
                              <Row className="m-0 p-0">
                                <Column className="text-white">
                                  Change my email
                                </Column>
                                <Column>
                                  <svg
                                    width="24"
                                    height="24"
                                    fill="none"
                                    stroke="currentColor"
                                    className="ml-[8px] text-white"
                                    strokeWidth="1.5"
                                    viewBox="0 0 24 24"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    xmlns="http://www.w3.org/2000/svg"
                                  >
                                    <path d="M4.5 12h15m0 0-5.625-6m5.625 6-5.625 6" />
                                  </svg>
                                </Column>
                              </Row>
                            </Button>
                          </td>
                        </tr>
                      </table>
                    </Section>
                    <Section className="mt-4">
                      <Text className="text-text-light m-0 p-0 text-base">
                        This confirmation step helps ensure the security of your
                        account and prevents unauthorized changes.
                      </Text>
                      <Text className="text-text-light m-0 mt-4 p-0 text-base">
                        Best regards,
                      </Text>
                      <Text className="text-text-light m-0 p-0 text-base">
                        The Shortn.at Team
                      </Text>
                    </Section>
                  </td>
                </tr>
              </table>
            </Section>

            <Section className="text-text-light mt-6 mb-4 text-left text-sm">
              <Text className="m-0 p-0 text-xs">
                This message was sent by Shortn.at. © 2025 Shortn.at. All
                rights reserved. View our{" "}
                <Link
                  href="https://shortn.at/privacy"
                  target="_blank"
                  className="text-[#2754C5] underline"
                >
                  privacy policy
                </Link>{" "}
                and{" "}
                <Link
                  href="https://shortn.at/terms"
                  target="_blank"
                  className="text-[#2754C5] underline"
                >
                  terms of service
                </Link>
                .
              </Text>
              <Section className="mt-4 text-left text-sm text-zinc-900">
                <table
                  cellPadding="0"
                  cellSpacing="0"
                  style={{ width: "100%" }}
                >
                  <tr>
                    <td>
                      <table cellPadding="0" cellSpacing="0">
                        <tr>
                          <td style={{ paddingRight: "16px" }}>
                            <Link href="https://x.com/shortn-at/">
                              <svg
                                width="24"
                                height="24"
                                fill="none"
                                stroke="currentColor"
                                className="text-zinc-900"
                                strokeWidth="1.5"
                                viewBox="0 0 24 24"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path d="m19 4-5.93 6.93M5 20l5.93-6.93m0 0 5.795 6.587c.19.216.483.343.794.343h1.474c.836 0 1.307-.85.793-1.435L13.07 10.93m-2.14 2.14L4.214 5.435C3.7 4.85 4.17 4 5.007 4h1.474c.31 0 .604.127.794.343l5.795 6.587" />
                              </svg>
                            </Link>
                          </td>
                          <td style={{ paddingRight: "16px" }}>
                            <Link href="https://www.instagram.com/shortn-at/">
                              <svg
                                width="24"
                                height="24"
                                fill="none"
                                stroke="currentColor"
                                className="text-zinc-900"
                                strokeWidth="1.5"
                                viewBox="0 0 24 24"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path d="M3 9.4c0-2.24 0-3.36.436-4.216a4 4 0 0 1 1.748-1.748C6.04 3 7.16 3 9.4 3h5.2c2.24 0 3.36 0 4.216.436a4 4 0 0 1 1.748 1.748C21 6.04 21 7.16 21 9.4v5.2c0 2.24 0 3.36-.436 4.216a4 4 0 0 1-1.748 1.748C17.96 21 16.84 21 14.6 21H9.4c-2.24 0-3.36 0-4.216-.436a4 4 0 0 1-1.748-1.748C3 17.96 3 16.84 3 14.6zm14-2.9h.5" />
                                <path d="M15.462 11.487a3.5 3.5 0 1 1-6.925 1.026 3.5 3.5 0 0 1 6.925-1.026" />
                              </svg>
                            </Link>
                          </td>
                          <td style={{ paddingRight: "16px" }}>
                            <Link href="https://www.threads.net/@shortn-at">
                              <svg
                                width="24"
                                height="24"
                                fill="none"
                                stroke="currentColor"
                                className="text-zinc-900"
                                strokeWidth="1.5"
                                viewBox="0 0 24 24"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path d="M9.77 8.515c2.23-1.812 5.444-.845 5.823 2.135.403 3.163-.4 5.67-3.52 5.67-2.895 0-2.806-2.52-2.806-2.52 0-2.7 4.589-3.06 7.262-1.71 4.9 3.15 1.336 8.91-4.01 8.91C8.09 21 4.5 18.75 4.5 12s3.59-9 8.02-9c3.125 0 5.944 1.626 6.98 4.879" />
                              </svg>
                            </Link>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </Section>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
