import { tailwindConfig } from "@/lib/email.tailwind.config";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";

interface VerifyEmailProps {
  verificationLink?: string;
}

const baseUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "";

export const VerifyReactEmail = ({ verificationLink }: VerifyEmailProps) => {
  return (
    <Html>
      <Head />
      <Tailwind config={tailwindConfig}>
        <Body className="bg-white font-sans text-[#212121]">
          <Preview>Shortn.at Account Verification</Preview>
          <Container className="p-5 mx-auto bg-[#eee]">
            <Section className="bg-white">
              <Section className="bg-[#252f3d] flex py-5 items-center justify-center">
                <Img
                  src={`${baseUrl}/logo.png`}
                  width="45"
                  height="45"
                  alt="Shortn.at's Logo"
                />
              </Section>
              <Section className="py-[25px] px-[35px]">
                <Heading className="text-[#333] text-[20px] font-bold mb-[15px]">
                  Verify your email address
                </Heading>
                <Text className="text-[#333] text-[14px] leading-[24px] mt-6 mb-[14px] mx-0">
                  Thanks for signing up for Shortn.at! We need to verify your
                  email address to complete your account setup. Please enter the
                  following verification code when prompted. If you didn&apos;t
                  create an account, you can safely ignore this message.
                </Text>
                <Section className="flex items-center justify-center">
                  <Button
                    href={verificationLink}
                    className="bg-[#252f3d] text-white text-[14px] font-semibold no-underline text-center px-5 py-3 rounded-md"
                  >
                    Verify Email Address
                  </Button>

                  <Text className="text-[#666] text-[12px] mt-4 mb-0">
                    Or copy and paste this link in your browser:
                  </Text>
                  <Link
                    href={verificationLink}
                    className="text-[#2754C5] text-[12px] break-all mt-2"
                  >
                    {verificationLink}
                  </Link>

                  <Text className="text-[#333] text-[14px] mb-0 text-center">
                    (This link is valid for 10 minutes)
                  </Text>
                </Section>
              </Section>
              <Hr />
              <Section className="py-[25px] px-[35px]">
                <Text className="text-[#333] text-[14px] m-0">
                  Shortn.at will never email you asking you to disclose or
                  verify your password or payment information.
                </Text>
              </Section>
            </Section>
            <Text className="text-[#333] text-[12px] my-[24px] mx-0 px-5 py-0">
              This message was sent by Shortn.at. © 2025 Shortn.at. All rights
              reserved. View our{" "}
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
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};
