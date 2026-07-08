// import { db } from "@/prisma/db";
// import { getAuthUser } from "@/config/useAuth";
// import { Resend } from "resend";

// const resend = new Resend(process.env.RESEND_API_KEY);

// export interface User {
//   id: string;
//   name: string | null;
//   email: string;
//   phone: string | null;
//   role: string;
//   createdAt: Date;
// }

// export interface Account {
//   id: string;
//   accountNumber: string;
//   accountType: string;
//   balance: number;
//   status: string;
// }

// export interface Loan {
//   id: string;
//   status: string;
// }

// export interface Member {
//   id: string;
//   userId: string;
//   // Personal information fields
//   surname?: string | null;
//   otherNames?: string | null;
//   age?: number | null;
//   gender?: string | null; // Consider using Gender enum type
//   maritalStatus?: string | null; // Consider using MaritalStatus enum type
//   maritalOther?: string | null;
//   // Address fields
//   village?: string | null;
//   parish?: string | null;
//   subCounty?: string | null;
//   constituency?: string | null;
//   town?: string | null;
//   district?: string | null;
//   postalAddress?: string | null;
//   // Background/Education fields
//   levelOfEducation?: string | null;
//   citizenship?: string | null;
//   occupation?: string | null;
//   otherFinancialInstitutions?: string | null;
//   // Family/Next of Kin fields
//   nokName?: string | null;
//   nokRelationship?: string | null;
//   nokPhone?: string | null;
//   numberOfChildren?: number | null;
//   numberOfDependants?: number | null;
//   fatherName?: string | null;
//   motherName?: string | null;
//   // Identity fields - ADD THESE
//   nin?: string | null;
//   typeOfId?: string | null;
//   // Document fields
//   passportPhoto?: string | null;
//   idCopyPath?: string | null;
//   // SACCO certification fields
//   certifiedBy?: string | null;
//   certifierAccountNo?: string | null;
//   certifierPhone?: string | null;
//   certificationDate?: Date | null;
//   // Withdrawal instructions
//   withdrawalInstructions?: string | null;
//   // Timestamps
//   createdAt: Date;
//   updatedAt: Date;
//   user?: User;
//   accounts?: Account[];
//   loans?: Loan[];
// }
// export async function getAllMembers() {
//   try {
//     const user = await getAuthUser();
//     if (!user) {
//       throw new Error("Unauthorized");
//     }

//     const members = await db.member.findMany({
//       include: {
//         user: {
//           select: {
//             id: true,
//             name: true,
//             email: true,
//             phone: true,
//             role: true,
//           },
//         },
//         accounts: {
//           select: {
//             id: true,
//             accountNumber: true,
//             accountType: true,
//             balance: true,
//             status: true,
//           },
//         },
//         loans: {
//           select: {
//             id: true,
//             // amount: true,
//             status: true,
//             // loanDate: true,
//           },
//         },
//       },
//       orderBy: {
//         createdAt: "desc",
//       },
//     });

//     return members;
//   } catch (error) {
//     console.error("Error fetching members:", error);
//     throw new Error("Failed to fetch members");
//   }
// }

// export async function getAllUsers() {
//   try {
//     const user = await getAuthUser();
//     if (!user) {
//       throw new Error("Unauthorized");
//     }

//     const users = await db.user.findMany({
//       select: {
//         id: true,
//         name: true,
//         email: true,
//         phone: true,
//         role: true,
//         createdAt: true,
//       },
//       orderBy: {
//         createdAt: "desc",
//       },
//     });

//     return users;
//   } catch (error) {
//     console.error("Error fetching users:", error);
//     throw new Error("Failed to fetch users");
//   }
// }

// export async function sendBulkEmail(data: {
//   recipients: string[];
//   subject: string;
//   message: string;
// }) {
//   try {
//     const user = await getAuthUser();
//     if (!user || (user.role !== "ADMIN" && user.role !== "MANAGER")) {
//       throw new Error("Unauthorized");
//     }

//     const results = await Promise.allSettled(
//       data.recipients.map(async (email) => {
//         return await resend.emails.send({
//           from: "noreply@yourdomain.com",
//           to: email,
//           subject: data.subject,
//           html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
//             <h2 style="color: #333;">${data.subject}</h2>
//             <div style="background: #f9f9f9; padding: 20px; border-radius: 8px;">
//               ${data.message.replace(/\n/g, "<br>")}
//             </div>
//             <p style="color: #666; font-size: 12px; margin-top: 20px;">
//               This email was sent from your financial management system.
//             </p>
//           </div>`,
//         });
//       })
//     );

//     const successful = results.filter(
//       (result) => result.status === "fulfilled"
//     ).length;
//     const failed = results.filter(
//       (result) => result.status === "rejected"
//     ).length;

//     return {
//       success: true,
//       sent: successful,
//       failed: failed,
//       total: data.recipients.length,
//     };
//   } catch (error) {
//     console.error("Error sending bulk email:", error);
//     throw new Error("Failed to send emails");
//   }
// }

// export async function sendBulkSMS(data: {
//   recipients: string[];
//   message: string;
// }) {
//   try {
//     const user = await getAuthUser();
//     if (!user || (user.role !== "ADMIN" && user.role !== "MANAGER")) {
//       throw new Error("Unauthorized");
//     }

//     // Simulate SMS sending - replace with actual SMS service integration
//     const results = data.recipients.map((phone) => ({
//       phone,
//       status: Math.random() > 0.1 ? "sent" : "failed", // 90% success rate simulation
//     }));

//     const successful = results.filter((r) => r.status === "sent").length;
//     const failed = results.filter((r) => r.status === "failed").length;

//     return {
//       success: true,
//       sent: successful,
//       failed: failed,
//       total: data.recipients.length,
//       results,
//     };
//   } catch (error) {
//     console.error("Error sending bulk SMS:", error);
//     throw new Error("Failed to send SMS messages");
//   }
// }

import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";
// Remove these problematic lines:
// import { Resend } from "resend";
// const resend = new Resend(process.env.RESEND_API_KEY);

// Add the missing enums
export enum FinancialDiscipline {
  EXCELLENT = "EXCELLENT",
  GOOD = "GOOD",
  FAIR = "FAIR",
  POOR = "POOR",
}

export enum OtherSaccosCount {
  NONE = "NONE",
  ONE = "ONE",
  TWO = "TWO",
  THREE_OR_MORE = "THREE_OR_MORE",
}

// Additional helpful enums
export enum Gender {
  MALE = "MALE",
  FEMALE = "FEMALE",
  OTHER = "OTHER",
}

export enum MaritalStatus {
  SINGLE = "SINGLE",
  MARRIED = "MARRIED",
  DIVORCED = "DIVORCED",
  WIDOWED = "WIDOWED",
  SEPARATED = "SEPARATED",
  OTHER = "OTHER",
}

export enum LevelOfEducation {
  NONE = "NONE",
  PRIMARY = "PRIMARY",
  SECONDARY = "SECONDARY",
  TERTIARY = "TERTIARY",
  UNIVERSITY = "UNIVERSITY",
  POSTGRADUATE = "POSTGRADUATE",
}

export interface User {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  role: string;
  createdAt: Date;
}

export interface Account {
  id: string;
  accountNumber: string;
  accountType: string;
  balance: number;
  status: string;
}

export interface Loan {
  id: string;
  status: string;
}

export interface Member {
  id: string;
  userId: string;
  memberNumber?: string;
  registrationDate?: Date;
  isApproved?: boolean;

  // Personal information fields
  surname?: string | null;
  otherNames?: string | null;
  age?: number | null;
  gender?: Gender | string | null;
  maritalStatus?: MaritalStatus | string | null;
  maritalOther?: string | null;

  // Address fields
  village?: string | null;
  parish?: string | null;
  subCounty?: string | null;
  constituency?: string | null;
  town?: string | null;
  district?: string | null;
  postalAddress?: string | null;

  // Background/Education fields
  levelOfEducation?: LevelOfEducation | string | null;
  citizenship?: string | null;
  occupation?: string | null;
  otherFinancialInstitutions?: string | null;

  // Family/Next of Kin fields
  nokName?: string | null;
  nokRelationship?: string | null;
  nokPhone?: string | null;
  numberOfChildren?: number | null;
  numberOfDependants?: number | null;
  fatherName?: string | null;
  motherName?: string | null;

  // Identity fields
  nin?: string | null;
  typeOfId?: string | null;

  // Document fields
  passportPhoto?: string | null;
  idCopyPath?: string | null;

  // SACCO certification fields
  certifiedBy?: string | null;
  certifierAccountNo?: string | null;
  certifierPhone?: string | null;
  certificationDate?: Date | null;

  // Add the missing fields for financial discipline and other saccos
  financialDiscipline?: FinancialDiscipline | string | null;
  otherSaccosCount?: OtherSaccosCount | string | null;

  // Withdrawal instructions
  withdrawalInstructions?: string | null;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  user?: User;
  accounts?: Account[];
  loans?: Loan[];
}

// DTO interfaces for creating and updating members
export interface MemberCreateDTO {
  userId: string;
  surname: string;
  otherNames: string;
  age?: number;
  gender?: Gender | string;
  maritalStatus?: MaritalStatus | string;
  maritalOther?: string;
  village?: string;
  parish?: string;
  subCounty?: string;
  constituency?: string;
  town?: string;
  district?: string;
  postalAddress?: string;
  levelOfEducation?: LevelOfEducation | string;
  citizenship?: string;
  occupation?: string;
  otherFinancialInstitutions?: string;
  nokName?: string;
  nokRelationship?: string;
  nokPhone?: string;
  numberOfChildren?: number;
  numberOfDependants?: number;
  fatherName?: string;
  motherName?: string;
  nin: string;
  typeOfId?: string;
  passportPhoto?: string;
  idCopyPath?: string;
  certifiedBy?: string;
  certifierAccountNo?: string;
  certifierPhone?: string;
  certificationDate?: Date;
  financialDiscipline?: FinancialDiscipline | string;
  otherSaccosCount?: OtherSaccosCount | string;
  withdrawalInstructions?: string;
}

export interface MemberUpdateDTO {
  surname?: string;
  otherNames?: string;
  age?: number;
  gender?: Gender | string;
  maritalStatus?: MaritalStatus | string;
  maritalOther?: string;
  village?: string;
  parish?: string;
  subCounty?: string;
  constituency?: string;
  town?: string;
  district?: string;
  postalAddress?: string;
  levelOfEducation?: LevelOfEducation | string;
  citizenship?: string;
  occupation?: string;
  otherFinancialInstitutions?: string;
  nokName?: string;
  nokRelationship?: string;
  nokPhone?: string;
  numberOfChildren?: number;
  numberOfDependants?: number;
  fatherName?: string;
  motherName?: string;
  nin?: string;
  typeOfId?: string;
  passportPhoto?: string;
  idCopyPath?: string;
  certifiedBy?: string;
  certifierAccountNo?: string;
  certifierPhone?: string;
  certificationDate?: Date;
  financialDiscipline?: FinancialDiscipline | string;
  otherSaccosCount?: OtherSaccosCount | string;
  withdrawalInstructions?: string;
  isApproved?: boolean;
}

// Database operations (these should be moved to a separate service file)
export async function getAllMembers() {
  try {
    const user = await getAuthUser();
    if (!user) {
      throw new Error("Unauthorized");
    }

    const members = await db.member.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
          },
        },
        accounts: {
          select: {
            id: true,
            accountNumber: true,
            accountType: true,
            balance: true,
            status: true,
          },
        },
        loans: {
          select: {
            id: true,
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return members;
  } catch (error) {
    console.error("Error fetching members:", error);
    throw new Error("Failed to fetch members");
  }
}

export async function getAllUsers() {
  try {
    const user = await getAuthUser();
    if (!user) {
      throw new Error("Unauthorized");
    }

    const users = await db.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return users;
  } catch (error) {
    console.error("Error fetching users:", error);
    throw new Error("Failed to fetch users");
  }
}

// Note: Email functions removed from types file.
// These should be moved to a separate service file or server actions.
