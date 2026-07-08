// import * as React from "react";
// import {
//   Body,
//   Container,
//   Head,
//   Heading,
//   Html,
//   Preview,
//   Section,
//   Text,
//   Tailwind,
//   Row,
//   Column,
//   Hr,
//   Button,
// } from "@react-email/components";
// export type WelcomeProps = {
//   memberName: string;
//   memberNumber: string;
//   email: string;
//   password: string;
//   loginUrl: string;
// };
// const WelcomeEmail = (props: WelcomeProps) => {
//   return (
//     <Html lang="en" dir="ltr">
//       <Tailwind>
//         <Head />
//         <Preview>
//           Welcome to bukonzo Teachers SACCO - Your account is ready!
//         </Preview>
//         <Body className="bg-gray-100 font-sans py-[40px]">
//           <Container className="mx-auto max-w-[600px]">
//             {/* Main Card */}
//             <Section className="bg-white rounded-[16px] shadow-lg overflow-hidden">
//               {/* Header with Solid Background */}
//               <Section className="bg-emerald-600 px-[40px] py-[32px] text-center">
//                 <Heading className="text-white text-[28px] font-bold m-0 mb-[8px]">
//                   Welcome to bukonzo Teachers SACCO
//                 </Heading>
//                 <Text className="text-emerald-100 text-[16px] m-0">
//                   Your financial journey begins here
//                 </Text>
//               </Section>

//               {/* Content Section */}
//               <Section className="px-[40px] py-[32px]">
//                 <Text className="text-gray-700 text-[16px] leading-[24px] mb-[24px]">
//                   Dear {props.memberName},
//                 </Text>

//                 <Text className="text-gray-700 text-[16px] leading-[24px] mb-[32px]">
//                   Congratulations! Your membership with bukonzo Teachers SACCO
//                   has been successfully activated. We're excited to have you
//                   join our community of educators building financial prosperity
//                   together.
//                 </Text>

//                 {/* Login Credentials Card */}
//                 <Section className="bg-emerald-50 border border-emerald-200 rounded-[12px] p-[24px] mb-[32px]">
//                   <Heading className="text-emerald-800 text-[20px] font-semibold m-0 mb-[16px] text-center">
//                     Your Account Details
//                   </Heading>

//                   <Row className="mb-[16px]">
//                     <Column>
//                       <Text className="text-emerald-700 text-[14px] font-semibold m-0 mb-[4px]">
//                         Member Number:
//                       </Text>
//                       <Text className="text-gray-800 text-[16px] font-mono bg-white px-[12px] py-[8px] rounded-[6px] border border-emerald-200 m-0">
//                         {props.memberNumber}
//                       </Text>
//                     </Column>
//                   </Row>

//                   <Row className="mb-[16px]">
//                     <Column>
//                       <Text className="text-emerald-700 text-[14px] font-semibold m-0 mb-[4px]">
//                         Email Address:
//                       </Text>
//                       <Text className="text-gray-800 text-[16px] font-mono bg-white px-[12px] py-[8px] rounded-[6px] border border-emerald-200 m-0">
//                         {props.email}
//                       </Text>
//                     </Column>
//                   </Row>

//                   <Row className="mb-[20px]">
//                     <Column>
//                       <Text className="text-emerald-700 text-[14px] font-semibold m-0 mb-[4px]">
//                         Temporary Password:
//                       </Text>
//                       <Text className="text-gray-800 text-[16px] font-mono bg-white px-[12px] py-[8px] rounded-[6px] border border-emerald-200 m-0">
//                         {props.password}
//                       </Text>
//                     </Column>
//                   </Row>

//                   {/* Login Button */}
//                   <Section className="text-center mb-[16px]">
//                     <Button
//                       href={props.loginUrl}
//                       className="bg-emerald-600 text-white px-[32px] py-[12px] rounded-[8px] text-[16px] font-semibold no-underline box-border"
//                     >
//                       Login to Your Account
//                     </Button>
//                   </Section>

//                   <Section className="bg-amber-50 border border-amber-200 rounded-[8px] p-[16px]">
//                     <Text className="text-amber-800 text-[14px] m-0 text-center">
//                       🔒 <strong>Security Notice:</strong> Please change your
//                       password after your first login for enhanced security.
//                     </Text>
//                   </Section>
//                 </Section>

//                 {/* Next Steps */}
//                 <Section className="mb-[32px]">
//                   <Heading className="text-gray-800 text-[18px] font-semibold mb-[16px]">
//                     Next Steps:
//                   </Heading>

//                   <Text className="text-gray-700 text-[16px] leading-[24px] mb-[8px]">
//                     1. Click the login button above or visit{" "}
//                     <span className="text-emerald-600 font-semibold">
//                       portal.bukotosacco.ug
//                     </span>
//                   </Text>
//                   <Text className="text-gray-700 text-[16px] leading-[24px] mb-[8px]">
//                     2. Log in using the credentials provided above
//                   </Text>
//                   <Text className="text-gray-700 text-[16px] leading-[24px] mb-[8px]">
//                     3. Update your password and complete your profile
//                   </Text>
//                   <Text className="text-gray-700 text-[16px] leading-[24px] mb-[16px]">
//                     4. Explore our savings and loan products
//                   </Text>
//                 </Section>

//                 {/* Benefits Section */}
//                 <Section className="border-l-[4px] border-emerald-500 pl-[20px] mb-[32px]">
//                   <Heading className="text-gray-800 text-[18px] font-semibold mb-[12px]">
//                     Member Benefits:
//                   </Heading>
//                   <Text className="text-gray-700 text-[16px] leading-[24px] mb-[8px]">
//                     ✓ Competitive savings interest rates
//                   </Text>
//                   <Text className="text-gray-700 text-[16px] leading-[24px] mb-[8px]">
//                     ✓ Low-interest loans for teachers
//                   </Text>
//                   <Text className="text-gray-700 text-[16px] leading-[24px] mb-[8px]">
//                     ✓ Financial literacy training
//                   </Text>
//                   <Text className="text-gray-700 text-[16px] leading-[24px]">
//                     ✓ 24/7 online banking access
//                   </Text>
//                 </Section>

//                 <Text className="text-gray-700 text-[16px] leading-[24px] mb-[24px]">
//                   If you have any questions or need assistance, please don't
//                   hesitate to contact our member support team at
//                   <span className="text-emerald-600 font-semibold">
//                     {" "}
//                     support@ bukonzosacco.ug
//                   </span>{" "}
//                   or call us at
//                   <span className="text-emerald-600 font-semibold">
//                     {" "}
//                     +256-700-123-456
//                   </span>
//                   .
//                 </Text>

//                 <Text className="text-gray-700 text-[16px] leading-[24px]">
//                   Welcome aboard!
//                 </Text>

//                 <Text className="text-gray-700 text-[16px] leading-[24px] mt-[24px]">
//                   <strong>The bukonzo Teachers SACCO Team</strong>
//                 </Text>
//               </Section>
//             </Section>

//             {/* Footer */}
//             <Section className="text-center mt-[32px]">
//               <Hr className="border-gray-300 my-[24px]" />
//               <Text className="text-gray-500 text-[14px] m-0 mb-[8px]">
//                 bukonzo Teachers SACCO Limited
//               </Text>
//               <Text className="text-gray-500 text-[14px] m-0 mb-[8px]">
//                 Plot 123, bukonzo Street, Kampala, Uganda
//               </Text>
//               <Text className="text-gray-500 text-[14px] m-0 mb-[16px]">
//                 Licensed by Uganda Cooperative Alliance | Member SACCO
//                 Protection Scheme
//               </Text>
//               <Text className="text-gray-500 text-[12px] m-0">
//                 © 2025 bukonzo Teachers SACCO. All rights reserved.
//               </Text>
//             </Section>
//           </Container>
//         </Body>
//       </Tailwind>
//     </Html>
//   );
// };

// WelcomeEmail.PreviewProps = {
//   memberName: "Sarah Nakamya",
//   memberNumber: "BTS-2025-001234",
//   email: "sarah.nakamya@bukotosacco.ug",
//   password: "BTS2025#Temp",
//   loginUrl: "https://portal.bukotosacco.ug/login",
// };

// export default WelcomeEmail;
// components/email-templates/welcome-email.tsx
import * as React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Tailwind,
  Row,
  Column,
  Hr,
  Button,
} from "@react-email/components";

export type WelcomeProps = {
  memberName: string;
  memberNumber: string;
  email: string;
  password: string;
  loginUrl: string;
};

export default function WelcomeEmail({
  memberName = "New Member",
  memberNumber = "MEM000000",
  email = "member@example.com",
  password = "TempPassword123",
  loginUrl = "https://portal.bukotosacco.ug/login",
}: WelcomeProps) {
  return (
    <Html lang="en" dir="ltr">
      <Tailwind>
        <Head />
        <Preview>
          Welcome to Bukonzo Teachers SACCO - Your account is ready!
        </Preview>
        <Body className="bg-gray-100 font-sans py-[40px]">
          <Container className="mx-auto max-w-[600px]">
            {/* Main Card */}
            <Section className="bg-white rounded-[16px] shadow-lg overflow-hidden">
              {/* Header with Solid Background */}
              <Section className="bg-emerald-600 px-[40px] py-[32px] text-center">
                <Heading className="text-white text-[28px] font-bold m-0 mb-[8px]">
                  Welcome to Bukonzo Teachers SACCO
                </Heading>
                <Text className="text-emerald-100 text-[16px] m-0">
                  Your financial journey begins here
                </Text>
              </Section>

              {/* Content Section */}
              <Section className="px-[40px] py-[32px]">
                <Text className="text-gray-700 text-[16px] leading-[24px] mb-[24px]">
                  Dear {memberName},
                </Text>

                <Text className="text-gray-700 text-[16px] leading-[24px] mb-[32px]">
                  Congratulations! Your membership with Bukonzo Teachers SACCO
                  has been successfully activated. We're excited to have you
                  join our community of educators building financial prosperity
                  together.
                </Text>

                {/* Login Credentials Card */}
                <Section className="bg-emerald-50 border border-emerald-200 rounded-[12px] p-[24px] mb-[32px]">
                  <Heading className="text-emerald-800 text-[20px] font-semibold m-0 mb-[16px] text-center">
                    Your Account Details
                  </Heading>

                  <Row className="mb-[16px]">
                    <Column>
                      <Text className="text-emerald-700 text-[14px] font-semibold m-0 mb-[4px]">
                        Member Number:
                      </Text>
                      <Text className="text-gray-800 text-[16px] font-mono bg-white px-[12px] py-[8px] rounded-[6px] border border-emerald-200 m-0">
                        {memberNumber}
                      </Text>
                    </Column>
                  </Row>

                  <Row className="mb-[16px]">
                    <Column>
                      <Text className="text-emerald-700 text-[14px] font-semibold m-0 mb-[4px]">
                        Email Address:
                      </Text>
                      <Text className="text-gray-800 text-[16px] font-mono bg-white px-[12px] py-[8px] rounded-[6px] border border-emerald-200 m-0">
                        {email}
                      </Text>
                    </Column>
                  </Row>

                  <Row className="mb-[20px]">
                    <Column>
                      <Text className="text-emerald-700 text-[14px] font-semibold m-0 mb-[4px]">
                        Temporary Password:
                      </Text>
                      <Text className="text-gray-800 text-[16px] font-mono bg-white px-[12px] py-[8px] rounded-[6px] border border-emerald-200 m-0">
                        {password}
                      </Text>
                    </Column>
                  </Row>

                  {/* Login Button */}
                  <Section className="text-center mb-[16px]">
                    <Button
                      href={loginUrl}
                      style={{
                        backgroundColor: "#059669",
                        color: "#ffffff",
                        padding: "12px 32px",
                        borderRadius: "8px",
                        textDecoration: "none",
                        display: "inline-block",
                        fontWeight: "600",
                      }}
                    >
                      Login to Your Account
                    </Button>
                  </Section>

                  <Section className="bg-amber-50 border border-amber-200 rounded-[8px] p-[16px]">
                    <Text className="text-amber-800 text-[14px] m-0 text-center">
                      🔒 <strong>Security Notice:</strong> Please change your
                      password after your first login for enhanced security.
                    </Text>
                  </Section>
                </Section>

                {/* Next Steps */}
                <Section className="mb-[32px]">
                  <Heading className="text-gray-800 text-[18px] font-semibold mb-[16px]">
                    Next Steps:
                  </Heading>

                  <Text className="text-gray-700 text-[16px] leading-[24px] mb-[8px]">
                    1. Click the login button above to access your account
                  </Text>
                  <Text className="text-gray-700 text-[16px] leading-[24px] mb-[8px]">
                    2. Log in using the credentials provided above
                  </Text>
                  <Text className="text-gray-700 text-[16px] leading-[24px] mb-[8px]">
                    3. Update your password and complete your profile
                  </Text>
                  <Text className="text-gray-700 text-[16px] leading-[24px] mb-[16px]">
                    4. Explore our savings and loan products
                  </Text>
                </Section>

                {/* Benefits Section */}
                <Section className="border-l-[4px] border-emerald-500 pl-[20px] mb-[32px]">
                  <Heading className="text-gray-800 text-[18px] font-semibold mb-[12px]">
                    Member Benefits:
                  </Heading>
                  <Text className="text-gray-700 text-[16px] leading-[24px] mb-[8px]">
                    ✓ Competitive savings interest rates
                  </Text>
                  <Text className="text-gray-700 text-[16px] leading-[24px] mb-[8px]">
                    ✓ Low-interest loans for teachers
                  </Text>
                  <Text className="text-gray-700 text-[16px] leading-[24px] mb-[8px]">
                    ✓ Financial literacy training
                  </Text>
                  <Text className="text-gray-700 text-[16px] leading-[24px]">
                    ✓ 24/7 online banking access
                  </Text>
                </Section>

                <Text className="text-gray-700 text-[16px] leading-[24px] mb-[24px]">
                  If you have any questions or need assistance, please contact
                  our support team at{" "}
                  <span className="text-emerald-600 font-semibold">
                    support@bukonzosacco.ug
                  </span>{" "}
                  or call{" "}
                  <span className="text-emerald-600 font-semibold">
                    +256-700-123-456
                  </span>
                  .
                </Text>

                <Text className="text-gray-700 text-[16px] leading-[24px]">
                  Welcome aboard!
                </Text>

                <Text className="text-gray-700 text-[16px] leading-[24px] mt-[24px]">
                  <strong>The Bukonzo Teachers SACCO Team</strong>
                </Text>
              </Section>
            </Section>

            {/* Footer */}
            <Section className="text-center mt-[32px]">
              <Hr className="border-gray-300 my-[24px]" />
              <Text className="text-gray-500 text-[14px] m-0 mb-[8px]">
                Bukonzo Teachers SACCO Limited
              </Text>
              <Text className="text-gray-500 text-[14px] m-0 mb-[8px]">
                Kampala, Uganda
              </Text>
              <Text className="text-gray-500 text-[12px] m-0">
                © 2025 Bukonzo Teachers SACCO. All rights reserved.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
