import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

interface ResetPasswordEmailProps {
  userFirstname?: string;
  token?: string;
}

export const ResetPasswordEmail = ({
  userFirstname,
  token,
}: ResetPasswordEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>Reset your Bukonzo Teachers SACCO Password</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={textBlue} className="text-center font-bold">
            Bukonzo Teachers SACCO
          </Heading>
          <Section>
            <Text style={text}>Hi {userFirstname},</Text>
            <Text style={text}>
              We received a request to reset the password for your account at 
              <strong> Bukonzo Teachers SACCO</strong>. Use the verification code below to complete the process:
            </Text>
            <Section style={codeContainer}>
              <Text style={codeText}>{token}</Text>
            </Section>
            <Text style={text}>
              If you didn&apos;t request a password reset, you can safely ignore
              this email. Your password will remain unchanged.
            </Text>
            <Text style={text}>
              To keep your account secure, please don&apos;t forward this email
              to anyone.
            </Text>

            <Hr style={hr} />
            <Text style={footer}>
              © {new Date().getFullYear()} Bukonzo Teachers SACCO. All rights reserved.
              <br />
              Supporting Teachers for a Better Future.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default ResetPasswordEmail;

const main = {
  backgroundColor: "#f6f9fc",
  padding: "40px 0",
};

const container = {
  backgroundColor: "#ffffff",
  border: "1px solid #f0f0f0",
  borderRadius: "8px",
  padding: "45px",
  maxWidth: "600px",
  margin: "0 auto",
};

const text = {
  fontSize: "16px",
  fontFamily:
    "'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif",
  fontWeight: "400",
  color: "#404040",
  lineHeight: "26px",
};

const textBlue = {
  color: "#1e3a8a",
  fontSize: "24px",
  textAlign: "center" as const,
  margin: "0 0 30px 0",
};

const codeContainer = {
  background: "rgba(30, 58, 138, 0.05)",
  borderRadius: "8px",
  border: "1px dashed #1e3a8a",
  margin: "30px auto",
  width: "fit-content",
  padding: "10px 40px",
};

const codeText = {
  color: "#1e3a8a",
  fontSize: "32px",
  fontWeight: "700",
  letterSpacing: "4px",
  margin: "0",
  fontFamily: "monospace",
};

const hr = {
  borderColor: "#e5e7eb",
  margin: "30px 0",
};

const footer = {
  color: "#9ca3af",
  fontSize: "12px",
  textAlign: "center" as const,
  lineHeight: "18px",
};
