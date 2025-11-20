import { tailwindConfig } from "@/lib/email.tailwind.config";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";

interface ResetPasswordEmailProps {
  resetLink?: string;
}

export const ResetPasswordEmail = ({ resetLink }: ResetPasswordEmailProps) => {
  return (
    <Html>
      <Head />
      <Tailwind config={tailwindConfig}>
        <Body className="bg-white font-sans text-[#212121]">
          <Preview>Reset your Shortn.at password</Preview>
          <Container className="p-5 mx-auto bg-[#eee]">
            <Section className="bg-white">
              <Section className="bg-[#252f3d] flex py-5 items-center justify-center">
                <Heading className="text-[#ffffff] text-[24px] font-bold">
                  Shortn.at
                </Heading>
              </Section>
              <Section className="py-[25px] px-[35px]">
                <Heading className="text-[#333] text-[20px] font-bold mb-[15px]">
                  Reset your password
                </Heading>
                <Text className="text-[#333] text-[14px] leading-[24px] mt-6 mb-[14px] mx-0">
                  We received a request to reset your password for your
                  Shortn.at account. Click the button below to set a new
                  password. If you did not request this, you can safely ignore
                  this email.
                </Text>
                <Section className="flex items-center justify-center">
                  <Button
                    href={resetLink}
                    className="bg-[#252f3d] text-white text-[14px] font-semibold no-underline text-center px-5 py-3 rounded-md"
                  >
                    Reset Password
                  </Button>

                  <Text className="text-[#666] text-[12px] mt-4 mb-0">
                    Or copy and paste this link in your browser:
                  </Text>
                  <Link
                    href={resetLink}
                    className="text-[#2754C5] text-[12px] break-all mt-2"
                  >
                    {resetLink}
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
                href={`${baseUrl}/privacy`}
                target="_blank"
                className="text-[#2754C5] underline text-[14px]"
              >
                privacy policy
              </Link>{" "}
              and{" "}
              <Link
                href={`${baseUrl}/terms`}
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
