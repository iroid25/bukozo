// @ts-nocheck
// // "use server";

// // import { db } from "@/prisma/db";
// // import { getAuthUser } from "@/config/useAuth";
// // import { Resend } from "resend";
// // import { revalidatePath } from "next/cache";

// // const resend = new Resend(process.env.RESEND_API_KEY);

// // // Interface for email sending
// // interface SendEmailParams {
// //   recipients: string[];
// //   subject: string;
// //   message: string;
// // }

// // interface EmailResult {
// //   sent: number;
// //   failed: number;
// //   errors?: string[];
// // }

// // // Get all users with emails for bulk email
// // export async function getAllUsers() {
// //   try {
// //     const users = await db.user.findMany({
// //       where: {
// //         email: {
// //           not: null,
// //         },
// //         isActive: true,
// //       },
// //       select: {
// //         id: true,
// //         name: true,
// //         email: true,
// //         role: true,
// //       },
// //       orderBy: {
// //         name: "asc",
// //       },
// //     });

// //     return users.filter((user) => user.email); // Extra filter to ensure email exists
// //   } catch (error) {
// //     console.error("Error fetching users for email:", error);
// //     return [];
// //   }
// // }

// // // Send bulk emails using server action
// // export async function sendBulkEmail({
// //   recipients,
// //   subject,
// //   message,
// // }: SendEmailParams): Promise<EmailResult> {
// //   try {
// //     // Check authentication
// //     const user = await getAuthUser();

// //     if (!user || (user.role !== "ADMIN" && user.role !== "MANAGER")) {
// //       throw new Error("Unauthorized");
// //     }

// //     // Validate input
// //     if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
// //       throw new Error("Recipients are required");
// //     }

// //     if (!subject || !message) {
// //       throw new Error("Subject and message are required");
// //     }

// //     console.log(`Sending emails to ${recipients.length} recipients`);

// //     // Send emails in batches to avoid rate limits
// //     const batchSize = 10;
// //     const results = [];

// //     for (let i = 0; i < recipients.length; i += batchSize) {
// //       const batch = recipients.slice(i, i + batchSize);

// //       const batchResults = await Promise.allSettled(
// //         batch.map(async (email: string) => {
// //           try {
// //             const result = await resend.emails.send({
// //               from: " bukonzo Teachers SACCO <info@bukonzounitedteacherscooperativesociety.com>", // Using your existing verified domain
// //               to: email,
// //               subject: subject,
// //               html: `
// //                 <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
// //                   <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
// //                     <h1 style="color: white; margin: 0; font-size: 24px;"> bukonzo Teachers SACCO</h1>
// //                   </div>
// //                   <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
// //                     <h2 style="color: #333; margin-bottom: 20px; font-size: 20px;">${subject}</h2>
// //                     <div style="line-height: 1.6; color: #555; font-size: 16px;">
// //                       ${message.replace(/\n/g, "<br>")}
// //                     </div>
// //                     <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
// //                     <div style="text-align: center;">
// //                       <p style="font-size: 14px; color: #888; margin: 0;">
// //                         This email was sent from  bukonzo Teachers SACCO
// //                       </p>
// //                       <p style="font-size: 12px; color: #888; margin: 5px 0 0 0;">
// //                         If you have any questions, please contact us at info@bukonzounitedteacherscooperativesociety.com
// //                       </p>
// //                     </div>
// //                   </div>
// //                 </div>
// //               `,
// //               text: `${subject}\n\n${message}\n\n---\nThis email was sent from  bukonzo Teachers SACCO`, // Plain text fallback
// //             });
// //             return { success: true, email, result };
// //           } catch (error: any) {
// //             console.error(`Failed to send email to ${email}:`, error);
// //             return { success: false, email, error: error.message };
// //           }
// //         })
// //       );

// //       results.push(...batchResults);

// //       // Add small delay between batches to avoid rate limits
// //       if (i + batchSize < recipients.length) {
// //         await new Promise((resolve) => setTimeout(resolve, 100));
// //       }
// //     }

// //     const sent = results.filter(
// //       (result) => result.status === "fulfilled" && result.value.success
// //     ).length;

// //     const failed = results.filter(
// //       (result) =>
// //         result.status === "rejected" ||
// //         (result.status === "fulfilled" && !result.value.success)
// //     ).length;

// //     const errors = results
// //       .filter(
// //         (result) =>
// //           result.status === "rejected" ||
// //           (result.status === "fulfilled" && !result.value.success)
// //       )
// //       .map((result) => {
// //         if (result.status === "rejected") {
// //           return result.reason.message;
// //         } else {
// //           return (result.value as any).error;
// //         }
// //       });

// //     // Log email activity for audit trail
// //     try {
// //       await db.notification.createMany({
// //         data: recipients.map((email) => ({
// //           type: "EMAIL",
// //           message: `${subject}: ${message}`,
// //           targetAddress: email,
// //           sentAt: new Date(),
// //           status: "SENT", // You might want to track individual statuses
// //         })),
// //         skipDuplicates: true,
// //       });
// //     } catch (auditError) {
// //       console.error("Error logging email activity:", auditError);
// //     }

// //     console.log(`Email sending completed: ${sent} sent, ${failed} failed`);

// //     return {
// //       sent,
// //       failed,
// //       errors: errors.length > 0 ? errors : undefined,
// //     };
// //   } catch (error: any) {
// //     console.error("Error sending bulk emails:", error);
// //     return {
// //       sent: 0,
// //       failed: recipients.length,
// //       errors: [error.message || "Failed to send email messages"],
// //     };
// //   }
// // }

// // // Get email statistics
// // export async function getEmailStats() {
// //   try {
// //     const totalSent = await db.notification.count({
// //       where: {
// //         type: "EMAIL",
// //         status: "SENT",
// //       },
// //     });

// //     const sentToday = await db.notification.count({
// //       where: {
// //         type: "EMAIL",
// //         status: "SENT",
// //         sentAt: {
// //           gte: new Date(new Date().setHours(0, 0, 0, 0)),
// //         },
// //       },
// //     });

// //     const sentThisMonth = await db.notification.count({
// //       where: {
// //         type: "EMAIL",
// //         status: "SENT",
// //         sentAt: {
// //           gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
// //         },
// //       },
// //     });

// //     return {
// //       totalSent,
// //       sentToday,
// //       sentThisMonth,
// //     };
// //   } catch (error) {
// //     console.error("Error fetching email stats:", error);
// //     return {
// //       totalSent: 0,
// //       sentToday: 0,
// //       sentThisMonth: 0,
// //     };
// //   }
// // }

// // // Keep your existing SMS functions for SMS functionality
// // export async function getAllUsersForSMS() {
// //   try {
// //     const users = await db.user.findMany({
// //       where: {
// //         phone: {
// //           not: null,
// //         },
// //         isActive: true,
// //       },
// //       select: {
// //         id: true,
// //         name: true,
// //         phone: true,
// //         role: true,
// //         email: true,
// //       },
// //       orderBy: {
// //         name: "asc",
// //       },
// //     });

// //     return users.filter((user) => user.phone); // Extra filter to ensure phone exists
// //   } catch (error) {
// //     console.error("Error fetching users for SMS:", error);
// //     return [];
// //   }
// // }

// // // SMS interfaces
// // export interface SMSUser {
// //   id: string;
// //   name: string;
// //   phone: string;
// //   role: string;
// //   email: string;
// // }

// // export interface SendSMSParams {
// //   recipients: string[];
// //   message: string;
// // }

// // export interface SMSResult {
// //   sent: number;
// //   failed: number;
// //   errors?: string[];
// // }

// // // Send bulk SMS - Replace this with your actual SMS provider
// // export async function sendBulkSMS({
// //   recipients,
// //   message,
// // }: SendSMSParams): Promise<SMSResult> {
// //   try {
// //     // Check authentication
// //     const user = await getAuthUser();

// //     if (!user || (user.role !== "ADMIN" && user.role !== "BRANCHMANAGER")) {
// //       throw new Error("Unauthorized");
// //     }

// //     // TODO: Replace this simulation with your actual SMS provider
// //     // For Uganda, popular options include:
// //     // - Africa's Talking
// //     // - Twilio
// //     // - SMS solutions from MTN/Airtel

// //     console.log(`Preparing to send SMS to ${recipients.length} recipients`);
// //     console.log(`Message: ${message}`);

// //     // Simulate SMS sending with some realistic delays and occasional failures
// //     const results = await Promise.allSettled(
// //       recipients.map(async (phone, index) => {
// //         // Simulate network delay
// //         await new Promise((resolve) =>
// //           setTimeout(resolve, 100 + Math.random() * 200)
// //         );

// //         // Simulate occasional failures (5% failure rate)
// //         if (Math.random() > 0.95) {
// //           throw new Error(`Network timeout for ${phone}`);
// //         }

// //         // Log successful send
// //         console.log(`SMS sent to ${phone}`);
// //         return { phone, status: "sent" };
// //       })
// //     );

// //     const sent = results.filter(
// //       (result) => result.status === "fulfilled"
// //     ).length;
// //     const failed = results.filter(
// //       (result) => result.status === "rejected"
// //     ).length;
// //     const errors = results
// //       .filter((result) => result.status === "rejected")
// //       .map((result) => (result as PromiseRejectedResult).reason.message);

// //     // Log SMS activity for audit trail
// //     try {
// //       await db.notification.createMany({
// //         data: recipients.map((phone) => ({
// //           type: "SMS",
// //           message: message,
// //           targetAddress: phone,
// //           sentAt: new Date(),
// //           status: "SENT", // You might want to track individual statuses
// //         })),
// //         skipDuplicates: true,
// //       });
// //     } catch (auditError) {
// //       console.error("Error logging SMS activity:", auditError);
// //     }

// //     return {
// //       sent,
// //       failed,
// //       errors: errors.length > 0 ? errors : undefined,
// //     };
// //   } catch (error: any) {
// //     console.error("Error sending bulk SMS:", error);
// //     return {
// //       sent: 0,
// //       failed: recipients.length,
// //       errors: [error.message || "Failed to send SMS messages"],
// //     };
// //   }
// // }

// // // Get SMS statistics
// // export async function getSMSStats() {
// //   try {
// //     const totalSent = await db.notification.count({
// //       where: {
// //         type: "SMS",
// //         status: "SENT",
// //       },
// //     });

// //     const sentToday = await db.notification.count({
// //       where: {
// //         type: "SMS",
// //         status: "SENT",
// //         sentAt: {
// //           gte: new Date(new Date().setHours(0, 0, 0, 0)),
// //         },
// //       },
// //     });

// //     const sentThisMonth = await db.notification.count({
// //       where: {
// //         type: "SMS",
// //         status: "SENT",
// //         sentAt: {
// //           gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
// //         },
// //       },
// //     });

// //     return {
// //       totalSent,
// //       sentToday,
// //       sentThisMonth,
// //     };
// //   } catch (error) {
// //     console.error("Error fetching SMS stats:", error);
// //     return {
// //       totalSent: 0,
// //       sentToday: 0,
// //       sentThisMonth: 0,
// //     };
// //   }
// // }

// // export async function createUser(data: UserCreateDTO) {
// //   try {
// //     // Validate required fields
// //     if (!data.firstName || !data.lastName || !data.email || !data.password) {
// //       return {
// //         error: "First name, last name, email, and password are required",
// //         data: null,
// //       };
// //     }

// //     // Check if user with email already exists
// //     const existingUserByEmail = await db.user.findUnique({
// //       where: { email: data.email },
// //     });

// //     if (existingUserByEmail) {
// //       return {
// //         error: "User with this email already exists",
// //         data: null,
// //       };
// //     }

// //     // Check if phone number already exists (if provided)
// //     if (data.phone) {
// //       const existingUserByPhone = await db.user.findUnique({
// //         where: { phone: data.phone },
// //       });

// //       if (existingUserByPhone) {
// //         return {
// //           error: "User with this phone number already exists",
// //           data: null,
// //         };
// //       }
// //     }

// //     // Check if national ID already exists (if provided)
// //     if (data.nationalId) {
// //       const existingUserByNationalId = await db.user.findUnique({
// //         where: { nationalId: data.nationalId },
// //       });

// //       if (existingUserByNationalId) {
// //         return {
// //           error: "User with this national ID already exists",
// //           data: null,
// //         };
// //       }
// //     }

// //     // Hash password
// //     const hashedPassword = await bcrypt.hash(data.password, 12);

// //     // Prepare user data
// //     const userData = {
// //       firstName: data.firstName,
// //       lastName: data.lastName,
// //       name: data.name || `${data.firstName} ${data.lastName}`.trim(),
// //       email: data.email,
// //       password: hashedPassword,
// //       phone: data.phone || null,
// //       dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
// //       nationalId: data.nationalId || null,
// //       jobTitle: data.jobTitle || null,
// //       areaOfOperation: data.areaOfOperation || null,
// //       role: data.role || "MEMBER",
// //       branchId: data.branchId || null,
// //       image: data.image || null,
// //       isActive: true,
// //       isVerified: true,
// //     };

// //     // Create user in database
// //     const newUser = await db.user.create({
// //       data: userData,
// //     });

// //     // If user is a MEMBER, create Member record and send welcome email
// //     try {
// //       // Generate unique member number
// //       const memberNumber = await generateMemberNumber();

// //       // Create Member record
// //       const newMember = await db.member.create({
// //         data: {
// //           userId: newUser.id,
// //           memberNumber,
// //           registrationDate: new Date(),
// //           nin: data.nationalId || "",
// //           surname: data.firstName,
// //           otherNames: data.lastName,
// //           typeOfId: "National Identity Card",
// //           occupation: data.jobTitle,
// //           isApproved: false, // Requires admin approval
// //         },
// //       });

// //       // Send welcome email
// //       const emailResult = await sendWelcomeEmail({
// //         memberName: newUser.name,
// //         email: newUser.email,
// //         password: data.password, // Send the plain password in email
// //         memberNumber: newMember.memberNumber,
// //       });

// //       if (!emailResult.success) {
// //         console.warn(
// //           "User created but welcome email failed:",
// //           emailResult.error
// //         );
// //         // Don't fail the entire operation if email fails
// //       }
// //       // Create account
// //     } catch (error) {
// //       // If member creation fails, we should clean up the user
// //       await db.user.delete({ where: { id: newUser.id } });

// //       return {
// //         error: "Failed to complete member registration. Please try again.",
// //         data: null,
// //       };
// //     }

// //     // Revalidate related pages
// //     revalidatePath("/dashboard/users");
// //     revalidatePath("/dashboard");

// //     return {
// //       error: null,
// //       data: newUser,
// //     };
// //   } catch (error) {
// //     console.error("Error creating user:", error);
// //     return {
// //       error: "Failed to create user. Please try again.",
// //       data: null,
// //     };
// //   }
// // }

// // export async function deleteUser(id: string, path: string) {
// //   try {
// //     // Check if user exists
// //     const existingUser = await db.user.findUnique({
// //       where: { id },
// //     });

// //     if (!existingUser) {
// //       return {
// //         error: "User not found",
// //         data: null,
// //       };
// //     }

// //     // Soft delete by setting isActive to false
// //     const deletedUser = await db.user.update({
// //       where: { id },
// //       data: { isActive: false },
// //     });

// //     // Revalidate related pages
// //     revalidatePath(`/dashboard/users/${path}`);
// //     revalidatePath("/dashboard");
// //     return {
// //       error: null,
// //       data: { id: deletedUser.id },
// //     };
// //   } catch (error) {
// //     console.error("Error deleting user:", error);
// //     return {
// //       error: "Failed to delete user. Please try again.",
// //       data: null,
// //     };
// //   }
// // }

// // export async function getMember(id: string): Promise<MemberWithUser | null> {
// //   try {
// //     const member = await db.member.findUnique({
// //       where: { id },
// //       include: {
// //         user: true,
// //         accounts: {
// //           include: {
// //             accountType: true,
// //             branch: true,
// //           },
// //         },
// //       },
// //     });
// //     return member;
// //   } catch (error) {
// //     console.error("Failed to fetch member:", error);
// //     throw new Error("Failed to fetch members");
// //   }
// // }

// // @ts-nocheck
// "use server";

// import { db } from "@/prisma/db";
// import { getAuthUser } from "@/config/useAuth";
// import { Resend } from "resend";
// import { revalidatePath } from "next/cache";
// import bcrypt from "bcryptjs"; // Add this import

// const resend = new Resend(process.env.RESEND_API_KEY);

// // Interface for email sending
// interface SendEmailParams {
//   recipients: string[];
//   subject: string;
//   message: string;
// }

// interface EmailResult {
//   sent: number;
//   failed: number;
//   errors?: string[];
// }

// // You'll also need these interfaces that seem to be missing
// interface UserCreateDTO {
//   firstName: string;
//   lastName: string;
//   name?: string;
//   email: string;
//   password: string;
//   phone?: string;
//   dateOfBirth?: string;
//   nationalId?: string;
//   jobTitle?: string;
//   areaOfOperation?: string;
//   role?: string;
//   branchId?: string;
//   image?: string;
// }

// interface MemberWithUser {
//   id: string;
//   userId: string;
//   memberNumber: string;
//   registrationDate: Date;
//   nin: string;
//   surname: string;
//   otherNames: string;
//   typeOfId: string;
//   occupation: string | null;
//   isApproved: boolean;
//   user: any; // You should define proper User type
//   accounts: any[]; // You should define proper Account type
// }

// // Get all users with emails for bulk email
// export async function getAllUsers() {
//   try {
//     const users = await db.user.findMany({
//       where: {
//         email: {
//           not: null,
//         },
//         isActive: true,
//       },
//       select: {
//         id: true,
//         name: true,
//         email: true,
//         role: true,
//       },
//       orderBy: {
//         name: "asc",
//       },
//     });

//     return users.filter((user) => user.email); // Extra filter to ensure email exists
//   } catch (error) {
//     console.error("Error fetching users for email:", error);
//     return [];
//   }
// }

// // Send bulk emails using server action
// export async function sendBulkEmail({
//   recipients,
//   subject,
//   message,
// }: SendEmailParams): Promise<EmailResult> {
//   try {
//     // Check authentication
//     const user = await getAuthUser();

//     if (!user || (user.role !== "ADMIN" && user.role !== "BRANCHMANAGER")) {
//       throw new Error("Unauthorized");
//     }

//     // Validate input
//     if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
//       throw new Error("Recipients are required");
//     }

//     if (!subject || !message) {
//       throw new Error("Subject and message are required");
//     }

//     console.log(`Sending emails to ${recipients.length} recipients`);

//     // Send emails in batches to avoid rate limits
//     const batchSize = 10;
//     const results = [];

//     for (let i = 0; i < recipients.length; i += batchSize) {
//       const batch = recipients.slice(i, i + batchSize);

//       const batchResults = await Promise.allSettled(
//         batch.map(async (email: string) => {
//           try {
//             const result = await resend.emails.send({
//               from: " bukonzo Teachers SACCO <info@bukonzounitedteacherscooperativesociety.com>", // Using your existing verified domain
//               to: email,
//               subject: subject,
//               html: `
//                 <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
//                   <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
//                     <h1 style="color: white; margin: 0; font-size: 24px;"> bukonzo Teachers SACCO</h1>
//                   </div>
//                   <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
//                     <h2 style="color: #333; margin-bottom: 20px; font-size: 20px;">${subject}</h2>
//                     <div style="line-height: 1.6; color: #555; font-size: 16px;">
//                       ${message.replace(/\n/g, "<br>")}
//                     </div>
//                     <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
//                     <div style="text-align: center;">
//                       <p style="font-size: 14px; color: #888; margin: 0;">
//                         This email was sent from  bukonzo Teachers SACCO
//                       </p>
//                       <p style="font-size: 12px; color: #888; margin: 5px 0 0 0;">
//                         If you have any questions, please contact us at info@bukonzounitedteacherscooperativesociety.com
//                       </p>
//                     </div>
//                   </div>
//                 </div>
//               `,
//               text: `${subject}\n\n${message}\n\n---\nThis email was sent from  bukonzo Teachers SACCO`, // Plain text fallback
//             });
//             return { success: true, email, result };
//           } catch (error: any) {
//             console.error(`Failed to send email to ${email}:`, error);
//             return { success: false, email, error: error.message };
//           }
//         })
//       );

//       results.push(...batchResults);

//       // Add small delay between batches to avoid rate limits
//       if (i + batchSize < recipients.length) {
//         await new Promise((resolve) => setTimeout(resolve, 100));
//       }
//     }

//     const sent = results.filter(
//       (result) => result.status === "fulfilled" && result.value.success
//     ).length;

//     const failed = results.filter(
//       (result) =>
//         result.status === "rejected" ||
//         (result.status === "fulfilled" && !result.value.success)
//     ).length;

//     const errors = results
//       .filter(
//         (result) =>
//           result.status === "rejected" ||
//           (result.status === "fulfilled" && !result.value.success)
//       )
//       .map((result) => {
//         if (result.status === "rejected") {
//           return result.reason.message;
//         } else {
//           return (result.value as any).error;
//         }
//       });

//     // Log email activity for audit trail
//     try {
//       await db.notification.createMany({
//         data: recipients.map((email) => ({
//           type: "EMAIL",
//           message: `${subject}: ${message}`,
//           targetAddress: email,
//           sentAt: new Date(),
//           status: "SENT", // You might want to track individual statuses
//         })),
//         skipDuplicates: true,
//       });
//     } catch (auditError) {
//       console.error("Error logging email activity:", auditError);
//     }

//     console.log(`Email sending completed: ${sent} sent, ${failed} failed`);

//     return {
//       sent,
//       failed,
//       errors: errors.length > 0 ? errors : undefined,
//     };
//   } catch (error: any) {
//     console.error("Error sending bulk emails:", error);
//     return {
//       sent: 0,
//       failed: recipients.length,
//       errors: [error.message || "Failed to send email messages"],
//     };
//   }
// }

// // Get email statistics
// export async function getEmailStats() {
//   try {
//     const totalSent = await db.notification.count({
//       where: {
//         type: "EMAIL",
//         status: "SENT",
//       },
//     });

//     const sentToday = await db.notification.count({
//       where: {
//         type: "EMAIL",
//         status: "SENT",
//         sentAt: {
//           gte: new Date(new Date().setHours(0, 0, 0, 0)),
//         },
//       },
//     });

//     const sentThisMonth = await db.notification.count({
//       where: {
//         type: "EMAIL",
//         status: "SENT",
//         sentAt: {
//           gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
//         },
//       },
//     });

//     return {
//       totalSent,
//       sentToday,
//       sentThisMonth,
//     };
//   } catch (error) {
//     console.error("Error fetching email stats:", error);
//     return {
//       totalSent: 0,
//       sentToday: 0,
//       sentThisMonth: 0,
//     };
//   }
// }

// // Keep your existing SMS functions for SMS functionality
// export async function getAllUsersForSMS() {
//   try {
//     const users = await db.user.findMany({
//       where: {
//         phone: {
//           not: null,
//         },
//         isActive: true,
//       },
//       select: {
//         id: true,
//         name: true,
//         phone: true,
//         role: true,
//         email: true,
//       },
//       orderBy: {
//         name: "asc",
//       },
//     });

//     return users.filter((user) => user.phone); // Extra filter to ensure phone exists
//   } catch (error) {
//     console.error("Error fetching users for SMS:", error);
//     return [];
//   }
// }

// // SMS interfaces
// export interface SMSUser {
//   id: string;
//   name: string;
//   phone: string;
//   role: string;
//   email: string;
// }

// export interface SendSMSParams {
//   recipients: string[];
//   message: string;
// }

// export interface SMSResult {
//   sent: number;
//   failed: number;
//   errors?: string[];
// }

// // Send bulk SMS - Replace this with your actual SMS provider
// export async function sendBulkSMS({
//   recipients,
//   message,
// }: SendSMSParams): Promise<SMSResult> {
//   try {
//     // Check authentication
//     const user = await getAuthUser();

//     if (!user || (user.role !== "ADMIN" && user.role !== "MANAGER")) {
//       throw new Error("Unauthorized");
//     }

//     // TODO: Replace this simulation with your actual SMS provider
//     // For Uganda, popular options include:
//     // - Africa's Talking
//     // - Twilio
//     // - SMS solutions from MTN/Airtel

//     console.log(`Preparing to send SMS to ${recipients.length} recipients`);
//     console.log(`Message: ${message}`);

//     // Simulate SMS sending with some realistic delays and occasional failures
//     const results = await Promise.allSettled(
//       recipients.map(async (phone, index) => {
//         // Simulate network delay
//         await new Promise((resolve) =>
//           setTimeout(resolve, 100 + Math.random() * 200)
//         );

//         // Simulate occasional failures (5% failure rate)
//         if (Math.random() > 0.95) {
//           throw new Error(`Network timeout for ${phone}`);
//         }

//         // Log successful send
//         console.log(`SMS sent to ${phone}`);
//         return { phone, status: "sent" };
//       })
//     );

//     const sent = results.filter(
//       (result) => result.status === "fulfilled"
//     ).length;
//     const failed = results.filter(
//       (result) => result.status === "rejected"
//     ).length;
//     const errors = results
//       .filter((result) => result.status === "rejected")
//       .map((result) => (result as PromiseRejectedResult).reason.message);

//     // Log SMS activity for audit trail
//     try {
//       await db.notification.createMany({
//         data: recipients.map((phone) => ({
//           type: "SMS",
//           message: message,
//           targetAddress: phone,
//           sentAt: new Date(),
//           status: "SENT", // You might want to track individual statuses
//         })),
//         skipDuplicates: true,
//       });
//     } catch (auditError) {
//       console.error("Error logging SMS activity:", auditError);
//     }

//     return {
//       sent,
//       failed,
//       errors: errors.length > 0 ? errors : undefined,
//     };
//   } catch (error: any) {
//     console.error("Error sending bulk SMS:", error);
//     return {
//       sent: 0,
//       failed: recipients.length,
//       errors: [error.message || "Failed to send SMS messages"],
//     };
//   }
// }

// // Get SMS statistics
// export async function getSMSStats() {
//   try {
//     const totalSent = await db.notification.count({
//       where: {
//         type: "SMS",
//         status: "SENT",
//       },
//     });

//     const sentToday = await db.notification.count({
//       where: {
//         type: "SMS",
//         status: "SENT",
//         sentAt: {
//           gte: new Date(new Date().setHours(0, 0, 0, 0)),
//         },
//       },
//     });

//     const sentThisMonth = await db.notification.count({
//       where: {
//         type: "SMS",
//         status: "SENT",
//         sentAt: {
//           gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
//         },
//       },
//     });

//     return {
//       totalSent,
//       sentToday,
//       sentThisMonth,
//     };
//   } catch (error) {
//     console.error("Error fetching SMS stats:", error);
//     return {
//       totalSent: 0,
//       sentToday: 0,
//       sentThisMonth: 0,
//     };
//   }
// }

// // Helper function to generate member number - you'll need to implement this
// async function generateMemberNumber(): Promise<string> {
//   // Simple implementation - you might want to make this more sophisticated
//   const count = await db.member.count();
//   return `MEM${(count + 1).toString().padStart(6, "0")}`;
// }

// // Helper function to send welcome email - you'll need to implement this
// async function sendWelcomeEmail({
//   memberName,
//   email,
//   password,
//   memberNumber,
// }: {
//   memberName: string;
//   email: string;
//   password: string;
//   memberNumber: string;
// }): Promise<{ success: boolean; error?: string }> {
//   try {
//     const result = await resend.emails.send({
//       from: " bukonzo Teachers SACCO <info@bukonzounitedteacherscooperativesociety.com>",
//       to: email,
//       subject: "Welcome to  bukonzo Teachers SACCO",
//       html: `
//         <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
//           <h2>Welcome ${memberName}!</h2>
//           <p>Your account has been created successfully.</p>
//           <p><strong>Member Number:</strong> ${memberNumber}</p>
//           <p><strong>Email:</strong> ${email}</p>
//           <p><strong>Temporary Password:</strong> ${password}</p>
//           <p>Please change your password after your first login.</p>
//         </div>
//       `,
//     });
//     return { success: true };
//   } catch (error: any) {
//     return { success: false, error: error.message };
//   }
// }

// export async function createUser(data: UserCreateDTO) {
//   try {
//     // Validate required fields
//     if (!data.firstName || !data.lastName || !data.email || !data.password) {
//       return {
//         error: "First name, last name, email, and password are required",
//         data: null,
//       };
//     }

//     // Check if user with email already exists
//     const existingUserByEmail = await db.user.findUnique({
//       where: { email: data.email },
//     });

//     if (existingUserByEmail) {
//       return {
//         error: "User with this email already exists",
//         data: null,
//       };
//     }

//     // Check if phone number already exists (if provided)
//     if (data.phone) {
//       const existingUserByPhone = await db.user.findUnique({
//         where: { phone: data.phone },
//       });

//       if (existingUserByPhone) {
//         return {
//           error: "User with this phone number already exists",
//           data: null,
//         };
//       }
//     }

//     // Check if national ID already exists (if provided)
//     if (data.nationalId) {
//       const existingUserByNationalId = await db.user.findUnique({
//         where: { nationalId: data.nationalId },
//       });

//       if (existingUserByNationalId) {
//         return {
//           error: "User with this national ID already exists",
//           data: null,
//         };
//       }
//     }

//     // Hash password
//     const hashedPassword = await bcrypt.hash(data.password, 12);

//     // Prepare user data
//     const userData = {
//       firstName: data.firstName,
//       lastName: data.lastName,
//       name: data.name || `${data.firstName} ${data.lastName}`.trim(),
//       email: data.email,
//       password: hashedPassword,
//       phone: data.phone || null,
//       dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
//       nationalId: data.nationalId || null,
//       jobTitle: data.jobTitle || null,
//       areaOfOperation: data.areaOfOperation || null,
//       role: data.role || "MEMBER",
//       branchId: data.branchId || null,
//       image: data.image || null,
//       isActive: true,
//       isVerified: true,
//     };

//     // Create user in database
//     const newUser = await db.user.create({
//       data: userData,
//     });

//     // If user is a MEMBER, create Member record and send welcome email
//     try {
//       // Generate unique member number
//       const memberNumber = await generateMemberNumber();

//       // Create Member record
//       const newMember = await db.member.create({
//         data: {
//           userId: newUser.id,
//           memberNumber,
//           registrationDate: new Date(),
//           nin: data.nationalId || "",
//           surname: data.firstName,
//           otherNames: data.lastName,
//           typeOfId: "National Identity Card",
//           occupation: data.jobTitle,
//           approvalStatus: "PENDING", // Requires admin approval
//         },
//       });

//       // Send welcome email
//       const emailResult = await sendWelcomeEmail({
//         memberName: newUser.name,
//         email: newUser.email,
//         password: data.password, // Send the plain password in email
//         memberNumber: newMember.memberNumber,
//       });

//       if (!emailResult.success) {
//         console.warn(
//           "User created but welcome email failed:",
//           emailResult.error
//         );
//         // Don't fail the entire operation if email fails
//       }
//       // Create account
//     } catch (error) {
//       // If member creation fails, we should clean up the user
//       await db.user.delete({ where: { id: newUser.id } });

//       return {
//         error: "Failed to complete member registration. Please try again.",
//         data: null,
//       };
//     }

//     // Revalidate related pages
//     revalidatePath("/dashboard/users");
//     revalidatePath("/dashboard");

//     return {
//       error: null,
//       data: newUser,
//     };
//   } catch (error) {
//     console.error("Error creating user:", error);
//     return {
//       error: "Failed to create user. Please try again.",
//       data: null,
//     };
//   }
// }

// export async function deleteUser(id: string, path: string) {
//   try {
//     // Check if user exists
//     const existingUser = await db.user.findUnique({
//       where: { id },
//     });

//     if (!existingUser) {
//       return {
//         error: "User not found",
//         data: null,
//       };
//     }

//     // Soft delete by setting isActive to false
//     const deletedUser = await db.user.update({
//       where: { id },
//       data: { isActive: false },
//     });

//     // Revalidate related pages
//     revalidatePath(`/dashboard/users/${path}`);
//     revalidatePath("/dashboard");
//     return {
//       error: null,
//       data: { id: deletedUser.id },
//     };
//   } catch (error) {
//     console.error("Error deleting user:", error);
//     return {
//       error: "Failed to delete user. Please try again.",
//       data: null,
//     };
//   }
// }

// export async function getMember(id: string): Promise<MemberWithUser | null> {
//   try {
//     const member = await db.member.findUnique({
//       where: { id },
//       include: {
//         user: true,
//         accounts: {
//           include: {
//             accountType: true,
//             branch: true,
//           },
//         },
//       },
//     });
//     return member;
//   } catch (error) {
//     console.error("Failed to fetch member:", error);
//     throw new Error("Failed to fetch members");
//   }
// }
// actions/members.ts
"use server";

import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";
import { Resend } from "resend";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { EMAIL_FROM } from "@/lib/email";

const resend = new Resend(process.env.RESEND_API_KEY);

// Types
export interface UserCreateDTO {
  firstName: string;
  lastName: string;
  name?: string;
  email: string;
  password: string;
  phone?: string;
  dateOfBirth?: string;
  registrationDate?: string;
  nationalId?: string;
  idCard?: string;
  jobTitle?: string;
  areaOfOperation?: string;
  role?: string;
  branchId?: string;
  image?: string;
  fingerprintTemplate?: string | null;
  village?: string;
  parish?: string;
  subCounty?: string;
  postalAddress?: string;
  nokName?: string;
  nokRelationship?: string;
  nokPhone?: string;
}

export interface MemberWithUser {
  id: string;
  userId: string;
  memberNumber: string;
  registrationDate: Date;
  nin: string;
  surname: string;
  otherNames: string;
  typeOfId: string;
  occupation: string | null;
  isApproved: boolean;
  user: any;
  accounts: any[];
}

// Email and SMS interfaces
interface SendEmailParams {
  recipients: string[];
  subject: string;
  message: string;
}

interface EmailResult {
  sent: number;
  failed: number;
  errors?: string[];
}

export interface SMSUser {
  id: string;
  name: string;
  phone: string;
  role: string;
  email: string;
}

export interface SendSMSParams {
  recipients: string[];
  message: string;
}

export interface SMSResult {
  sent: number;
  failed: number;
  errors?: string[];
}

// Helper function to generate unique member number
async function generateMemberNumber(): Promise<string> {
  try {
    const currentYear = new Date().getFullYear();
    const memberCount = await db.member.count();
    const memberNumber = `${currentYear}${(memberCount + 1)
      .toString()
      .padStart(6, "0")}`;

    // Check for uniqueness
    const existingMember = await db.member.findUnique({
      where: { memberNumber },
    });

    if (existingMember) {
      const randomSuffix = Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, "0");
      return `${currentYear}${(memberCount + 1)
        .toString()
        .padStart(3, "0")}${randomSuffix}`;
    }

    return memberNumber;
  } catch (error) {
    console.error("Error generating member number:", error);
    return `MEM${Date.now()}`;
  }
}

// Helper function to send welcome email
async function sendWelcomeEmail({
  memberName,
  email,
  password,
  memberNumber,
}: {
  memberName: string;
  email: string;
  password: string;
  memberNumber: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await resend.emails.send({
      from: " bukonzo Teachers SACCO <info@bukonzounitedteacherscooperativesociety.com>",
      to: email,
      subject: "Welcome to  bukonzo Teachers SACCO",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;"> bukonzo Teachers SACCO</h1>
          </div>
          <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h2 style="color: #333; margin-bottom: 20px;">Welcome ${memberName}!</h2>
            <p style="font-size: 16px; color: #555; line-height: 1.6;">
              Your member account has been created successfully. Here are your login details:
            </p>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Member Number:</strong> ${memberNumber}</p>
              <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
              <p style="margin: 5px 0;"><strong>Temporary Password:</strong> ${password}</p>
            </div>
            <p style="font-size: 14px; color: #dc3545; margin-bottom: 20px;">
              <strong>Important:</strong> Please change your password after your first login for security purposes.
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.NEXT_PUBLIC_BASE_URL}/login" 
                 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                        color: white; padding: 12px 24px; text-decoration: none; 
                        border-radius: 6px; display: inline-block;">
                Login to Your Account
              </a>
            </div>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            <div style="text-align: center;">
              <p style="font-size: 14px; color: #888; margin: 0;">
                This email was sent from  bukonzo Teachers SACCO
              </p>
              <p style="font-size: 12px; color: #888; margin: 5px 0 0 0;">
                If you have any questions, please contact us at info@bukonzounitedteacherscooperativesociety.com
              </p>
            </div>
          </div>
        </div>
      `,
      text: `Welcome ${memberName}!\n\nYour member account has been created successfully.\n\nMember Number: ${memberNumber}\nEmail: ${email}\nTemporary Password: ${password}\n\nPlease change your password after your first login.\n\nLogin at: ${process.env.NEXT_PUBLIC_BASE_URL}/login\n\n---\nThis email was sent from  bukonzo Teachers SACCO`,
    });
    return { success: true };
  } catch (error: any) {
    console.error("Error sending welcome email:", error);
    return { success: false, error: error.message };
  }
}

// Main function to create user and member
export async function createUser(data: UserCreateDTO) {
  try {
    console.log("Creating user with data:", data);

    // Validate required fields
    if (!data.firstName || !data.lastName || !data.email || !data.password) {
      return {
        error: "First name, last name, email, and password are required",
        data: null,
      };
    }

    // Check if user with email already exists
    const existingUserByEmail = await db.user.findUnique({
      where: { email: data.email },
    });

    if (existingUserByEmail) {
      return {
        error: "User with this email already exists",
        data: null,
      };
    }

    // Check if phone number already exists (if provided)
    if (data.phone) {
      const existingUserByPhone = await db.user.findUnique({
        where: { phone: data.phone },
      });

      if (existingUserByPhone) {
        return {
          error: "User with this phone number already exists",
          data: null,
        };
      }
    }

    // Check if national ID already exists (if provided)
    if (data.nationalId) {
      const existingUserByNationalId = await db.user.findUnique({
        where: { nationalId: data.nationalId },
      });

      if (existingUserByNationalId) {
        return {
          error: "User with this national ID already exists",
          data: null,
        };
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 12);

    // Prepare user data
    const userData = {
      firstName: data.firstName,
      lastName: data.lastName,
      name: data.name || `${data.firstName} ${data.lastName}`.trim(),
      email: data.email,
      password: hashedPassword,
      phone: data.phone || null,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
      nationalId: data.nationalId || null,
      jobTitle: data.jobTitle || null,
      areaOfOperation: data.areaOfOperation || null,
      address: data.postalAddress || data.village || null,
      role: data.role || "MEMBER",
      branchId: data.branchId || null,
      image: data.image || null,
      isActive: true,
      isVerified: true,
    };

    console.log("Creating user with userData:", userData);

    // Create user in database
    const newUser = await db.user.create({
      data: userData,
    });

    console.log("User created successfully:", newUser.id);

    // If user is a MEMBER, create Member record and send welcome email
    if (newUser.role === "MEMBER") {
      console.log("Creating member record for user:", newUser.id);

      try {
        // Generate unique member number
        const memberNumber = await generateMemberNumber();
        console.log("Generated member number:", memberNumber);

        // Create Member record
        const newMember = await db.member.create({
          data: {
            userId: newUser.id,
            memberNumber,
            registrationDate: new Date(),
            nin: data.nationalId || "",
            surname: data.firstName,
            otherNames: data.lastName,
            typeOfId: data.nationalId ? "National Identity Card" : "Other",
            occupation: data.jobTitle || null,
            village: data.village || null,
            parish: data.parish || null,
            subCounty: data.subCounty || null,
            postalAddress: data.postalAddress || null,
            nokName: data.nokName || null,
            nokRelationship: data.nokRelationship || null,
            nokPhone: data.nokPhone || null,
            status: "PENDING_APPROVAL",
            isApproved: false, // Requires admin approval
          },
        });

        console.log("Member created successfully:", newMember.memberNumber);

        // Send welcome email
        try {
          const emailResult = await sendWelcomeEmail({
            memberName: newUser.name,
            email: newUser.email,
            password: data.password, // Send the plain password in email
            memberNumber: newMember.memberNumber,
          });

          if (!emailResult.success) {
            console.warn(
              "User and member created but welcome email failed:",
              emailResult.error,
            );
            // Don't fail the entire operation if email fails
          } else {
            console.log("Welcome email sent successfully");
          }
        } catch (emailError) {
          console.error("Email sending error:", emailError);
          // Don't fail the entire operation if email fails
        }

        // Send in-app welcome notification
        try {
          await db.notification.create({
            data: {
              userId: newUser.id,
              type: "IN_APP",
              subject: "Welcome to Bukonzo Teachers SACCO!",
              message: `Your membership registration is complete. Member Number: ${newMember.memberNumber}. Your account is pending admin approval. You will be notified once approved.`,
              targetAddress: "/dashboard",
              status: "PENDING",
            },
          });
        } catch (notifError) {
          console.error("Welcome notification error:", notifError);
        }

        // Create default account for the member (removed as per new requirement: must be approved first)
        /*
        try {
          const defaultAccountType = await db.accountType.findFirst({
            where: { name: "Savings" }, 
          });

          if (defaultAccountType) {
            await db.account.create({
              data: {
                memberId: newMember.id,
                accountTypeId: defaultAccountType.id,
                accountNumber: `SA${memberNumber}`, 
                balance: 0,
                isActive: true,
                branchId: data.branchId,
              },
            });
            console.log("Default savings account created");
          }
        } catch (accountError) {
          console.error("Error creating default account:", accountError);
        }
        */
      } catch (memberError) {
        console.error("Error creating member record:", memberError);

        // If member creation fails, we should clean up the user
        try {
          await db.user.delete({ where: { id: newUser.id } });
          console.log("User cleaned up due to member creation failure");
        } catch (cleanupError) {
          console.error("Error cleaning up user:", cleanupError);
        }

        return {
          error: "Failed to complete member registration. Please try again.",
          data: null,
        };
      }
    }

    // Revalidate related pages
    revalidatePath("/dashboard/users");
    revalidatePath("/dashboard/members");
    revalidatePath("/dashboard");

    console.log("User creation completed successfully");

    return {
      error: null,
      data: newUser,
    };
  } catch (error) {
    console.error("Error creating user:", error);
    return {
      error: "Failed to create user. Please try again.",
      data: null,
    };
  }
}

// Approve a pending member
export async function approveMember(memberId: string) {
  try {
    const user = await getAuthUser();
    if (
      !user ||
      (user.role !== "ADMIN" &&
        user.role !== "BRANCHMANAGER" &&
        user.role !== "ACCOUNTANT")
    ) {
      return {
        error:
          "Unauthorized. Only Managers and Accountants can approve members.",
        data: null,
      };
    }

    const member = await db.member.findUnique({
      where: { id: memberId },
      include: {
        user: true,
      },
    });

    if (!member) {
      return { error: "Member not found", data: null };
    }

    if (!member.fingerprintTemplate) {
      return {
        error: "Member must enroll a fingerprint before approval.",
        data: null,
      };
    }

    const updatedMember = await db.member.update({
      where: { id: memberId },
      data: {
        status: "ACTIVE",
        isApproved: true,
        approvalDate: new Date(),
        approvalStatus: "APPROVED",
        approvedAt: new Date(),
        approvedByUserId: user.id,
        certifiedBy: user.name || user.email,
      },
      include: { user: true },
    });

    revalidatePath("/dashboard/members");
    revalidatePath("/dashboard/users");

    return { error: null, data: updatedMember };
  } catch (error: any) {
    console.error("Error approving member:", error);
    return {
      error: error.message || "Failed to approve member. Please try again.",
      data: null,
    };
  }
}

// Reject a pending member
export async function rejectMember(memberId: string, reason: string) {
  try {
    const user = await getAuthUser();
    if (
      !user ||
      (user.role !== "ADMIN" &&
        user.role !== "BRANCHMANAGER" &&
        user.role !== "ACCOUNTANT")
    ) {
      return { error: "Unauthorized", data: null };
    }

    const updatedMember = await db.member.update({
      where: { id: memberId },
      data: {
        status: "SUSPENDED",
        isApproved: false,
        rejectionReason: reason,
      },
    });

    revalidatePath("/dashboard/members");

    return { error: null, data: updatedMember };
  } catch (error: any) {
    console.error("Error rejecting member:", error);
    return { error: error.message || "Failed to reject member.", data: null };
  }
}

// Get all users with emails for bulk email
export async function getAllUsers() {
  try {
    const users = await db.user.findMany({
      where: {
        email: {
          not: null,
        },
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return users.filter((user) => user.email);
  } catch (error) {
    console.error("Error fetching users for email:", error);
    return [];
  }
}

// Get all users for SMS
export async function getAllUsersForSMS() {
  try {
    const users = await db.user.findMany({
      where: {
        phone: {
          not: null,
        },
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        email: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return users.filter((user) => user.phone);
  } catch (error) {
    console.error("Error fetching users for SMS:", error);
    return [];
  }
}

// Send bulk emails
export async function sendBulkEmail({
  recipients,
  subject,
  message,
}: SendEmailParams): Promise<EmailResult> {
  try {
    const user = await getAuthUser();

    if (!user || (user.role !== "ADMIN" && user.role !== "MANAGER")) {
      throw new Error("Unauthorized");
    }

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      throw new Error("Recipients are required");
    }

    if (!subject || !message) {
      throw new Error("Subject and message are required");
    }

    console.log(`Sending emails to ${recipients.length} recipients`);

    const batchSize = 10;
    const results = [];

    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);

      const batchResults = await Promise.allSettled(
        batch.map(async (email: string) => {
          try {
            const result = await resend.emails.send({
      from: EMAIL_FROM,
              to: email,
              subject: subject,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 24px;"> bukonzo Teachers SACCO</h1>
                  </div>
                  <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <h2 style="color: #333; margin-bottom: 20px; font-size: 20px;">${subject}</h2>
                    <div style="line-height: 1.6; color: #555; font-size: 16px;">
                      ${message.replace(/\n/g, "<br>")}
                    </div>
                    <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                    <div style="text-align: center;">
                      <p style="font-size: 14px; color: #888; margin: 0;">
                        This email was sent from  bukonzo Teachers SACCO
                      </p>
                      <p style="font-size: 12px; color: #888; margin: 5px 0 0 0;">
                        If you have any questions, please contact us at info@bukonzounitedteacherscooperativesociety.com
                      </p>
                    </div>
                  </div>
                </div>
              `,
              text: `${subject}\n\n${message}\n\n---\nThis email was sent from  bukonzo Teachers SACCO`,
            });
            return { success: true, email, result };
          } catch (error: any) {
            console.error(`Failed to send email to ${email}:`, error);
            return { success: false, email, error: error.message };
          }
        }),
      );

      results.push(...batchResults);

      if (i + batchSize < recipients.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    const sent = results.filter(
      (result) => result.status === "fulfilled" && result.value.success,
    ).length;

    const failed = results.filter(
      (result) =>
        result.status === "rejected" ||
        (result.status === "fulfilled" && !result.value.success),
    ).length;

    const errors = results
      .filter(
        (result) =>
          result.status === "rejected" ||
          (result.status === "fulfilled" && !result.value.success),
      )
      .map((result) => {
        if (result.status === "rejected") {
          return result.reason.message;
        } else {
          return (result.value as any).error;
        }
      });

    try {
      await db.notification.createMany({
        data: recipients.map((email) => ({
          type: "EMAIL",
          message: `${subject}: ${message}`,
          targetAddress: email,
          sentAt: new Date(),
          status: "SENT",
        })),
        skipDuplicates: true,
      });
    } catch (auditError) {
      console.error("Error logging email activity:", auditError);
    }

    console.log(`Email sending completed: ${sent} sent, ${failed} failed`);

    return {
      sent,
      failed,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error: any) {
    console.error("Error sending bulk emails:", error);
    return {
      sent: 0,
      failed: recipients.length,
      errors: [error.message || "Failed to send email messages"],
    };
  }
}

// Send bulk SMS
export async function sendBulkSMS({
  recipients,
  message,
}: SendSMSParams): Promise<SMSResult> {
  try {
    const user = await getAuthUser();

    if (!user || (user.role !== "ADMIN" && user.role !== "MANAGER")) {
      throw new Error("Unauthorized");
    }

    console.log(`Preparing to send SMS to ${recipients.length} recipients`);
    console.log(`Message: ${message}`);

    // TODO: Replace with actual SMS provider implementation
    const results = await Promise.allSettled(
      recipients.map(async (phone, index) => {
        await new Promise((resolve) =>
          setTimeout(resolve, 100 + Math.random() * 200),
        );

        if (Math.random() > 0.95) {
          throw new Error(`Network timeout for ${phone}`);
        }

        console.log(`SMS sent to ${phone}`);
        return { phone, status: "sent" };
      }),
    );

    const sent = results.filter(
      (result) => result.status === "fulfilled",
    ).length;
    const failed = results.filter(
      (result) => result.status === "rejected",
    ).length;
    const errors = results
      .filter((result) => result.status === "rejected")
      .map((result) => (result as PromiseRejectedResult).reason.message);

    try {
      await db.notification.createMany({
        data: recipients.map((phone) => ({
          type: "SMS",
          message: message,
          targetAddress: phone,
          sentAt: new Date(),
          status: "SENT",
        })),
        skipDuplicates: true,
      });
    } catch (auditError) {
      console.error("Error logging SMS activity:", auditError);
    }

    return {
      sent,
      failed,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error: any) {
    console.error("Error sending bulk SMS:", error);
    return {
      sent: 0,
      failed: recipients.length,
      errors: [error.message || "Failed to send SMS messages"],
    };
  }
}

// Delete user (soft delete)
export async function deleteUser(id: string, path?: string) {
  try {
    const existingUser = await db.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return {
        error: "User not found",
        data: null,
      };
    }

    const deletedUser = await db.user.update({
      where: { id },
      data: { isActive: false },
    });

    if (path) {
      revalidatePath(`/dashboard/users/${path}`);
    }
    revalidatePath("/dashboard/users");
    revalidatePath("/dashboard");

    return {
      error: null,
      data: { id: deletedUser.id },
    };
  } catch (error) {
    console.error("Error deleting user:", error);
    return {
      error: "Failed to delete user. Please try again.",
      data: null,
    };
  }
}

// Get member by ID
export async function getMember(id: string): Promise<MemberWithUser | null> {
  try {
    const member = await db.member.findUnique({
      where: { id },
      include: {
        user: true,
        accounts: {
          include: {
            accountType: true,
            branch: true,
          },
        },
      },
    });
    return member;
  } catch (error) {
    console.error("Failed to fetch member:", error);
    throw new Error("Failed to fetch member");
  }
}

// Get email statistics
export async function getEmailStats() {
  try {
    const totalSent = await db.notification.count({
      where: {
        type: "EMAIL",
        status: "SENT",
      },
    });

    const sentToday = await db.notification.count({
      where: {
        type: "EMAIL",
        status: "SENT",
        sentAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    });

    const sentThisMonth = await db.notification.count({
      where: {
        type: "EMAIL",
        status: "SENT",
        sentAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
    });

    return {
      totalSent,
      sentToday,
      sentThisMonth,
    };
  } catch (error) {
    console.error("Error fetching email stats:", error);
    return {
      totalSent: 0,
      sentToday: 0,
      sentThisMonth: 0,
    };
  }
}

// Get SMS statistics
export async function getSMSStats() {
  try {
    const totalSent = await db.notification.count({
      where: {
        type: "SMS",
        status: "SENT",
      },
    });

    const sentToday = await db.notification.count({
      where: {
        type: "SMS",
        status: "SENT",
        sentAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    });

    const sentThisMonth = await db.notification.count({
      where: {
        type: "SMS",
        status: "SENT",
        sentAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
    });

    return {
      totalSent,
      sentToday,
      sentThisMonth,
    };
  } catch (error) {
    console.error("Error fetching SMS stats:", error);
    return {
      totalSent: 0,
      sentToday: 0,
      sentThisMonth: 0,
    };
  }
}
export async function getUserByIdDetailed(userId: string) {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            location: true,
            contactPerson: true,
            contactPhone: true,
            email: true,
          },
        },
        userFloat: {
          select: {
            id: true,
            balance: true,
            lastReconciliation: true,
            isActiveForDay: true,
            currentDayStarted: true,
            lastDayReconciled: true,
            canStartNewDay: true,
            pendingReconciliation: true,
          },
        },
        member: {
          include: {
            accounts: {
              include: {
                accountType: {
                  select: {
                    name: true,
                    interestRate: true,
                    minBalance: true,
                  },
                },
              },
            },
            loans: {
              orderBy: {
                disbursementDate: "desc",
              },
              take: 5,
              select: {
                id: true,
                amountGranted: true,
                outstandingBalance: true,
                status: true,
                disbursementDate: true,
                dueDate: true,
              },
            },
            loanApplications: {
              orderBy: {
                applicationDate: "desc",
              },
              take: 5,
              select: {
                id: true,
                amountApplied: true,
                status: true,
                stage: true,
                applicationDate: true,
              },
            },
          },
        },
        deposits: {
          orderBy: {
            depositDate: "desc",
          },
          take: 20,
          include: {
            member: {
              select: {
                id: true,
                memberNumber: true,
                user: {
                  select: {
                    name: true,
                  },
                },
              },
            },
            account: {
              select: {
                accountNumber: true,
                accountType: {
                  select: {
                    name: true,
                  },
                },
              },
            },
            transaction: {
              select: {
                transactionRef: true,
                status: true,
              },
            },
          },
        },
        withdrawals: {
          orderBy: {
            withdrawalDate: "desc",
          },
          take: 20,
          include: {
            member: {
              select: {
                id: true,
                memberNumber: true,
                user: {
                  select: {
                    name: true,
                  },
                },
              },
            },
            account: {
              select: {
                accountNumber: true,
                accountType: {
                  select: {
                    name: true,
                  },
                },
              },
            },
            transaction: {
              select: {
                transactionRef: true,
                status: true,
              },
            },
          },
        },
        loanRepayments: {
          orderBy: {
            repaymentDate: "desc",
          },
          take: 20,
          include: {
            member: {
              select: {
                id: true,
                memberNumber: true,
                user: {
                  select: {
                    name: true,
                  },
                },
              },
            },
            loan: {
              select: {
                id: true,
                amountGranted: true,
                outstandingBalance: true,
              },
            },
          },
        },
        floatTransactions: {
          orderBy: {
            transactionDate: "desc",
          },
          take: 20,
          select: {
            id: true,
            type: true,
            amount: true,
            transactionDate: true,
            description: true,
          },
        },
        floatReconciliation: {
          orderBy: {
            reconciliationDate: "desc",
          },
          take: 10,
          select: {
            id: true,
            reconciliationDate: true,
            actualCash: true,
            systemBalance: true,
            difference: true,
            isBalanced: true,
            status: true,
            reconciliationType: true,
            isEndOfDay: true,
          },
        },
        loanApplications: {
          orderBy: {
            applicationDate: "desc",
          },
          take: 10,
          include: {
            loanProduct: {
              select: {
                name: true,
                interestRate: true,
              },
            },
            member: {
              select: {
                memberNumber: true,
                user: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
        approvedReconciliations: {
          orderBy: {
            approvalDate: "desc",
          },
          take: 10,
          select: {
            id: true,
            reconciliationDate: true,
            approvalDate: true,
            reconciledByUser: {
              select: {
                name: true,
              },
            },
            float: {
              select: {
                user: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      return {
        error: "User not found",
        data: null,
      };
    }

    // Get audit logs for recent activity
    const auditLogs = await db.auditLog.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        timestamp: "desc",
      },
      take: 20,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        timestamp: true,
        details: true,
        ipAddress: true,
      },
    });

    // Calculate additional statistics
    const stats = {
      totalDeposits: user.deposits?.length || 0,
      totalDepositAmount:
        user.deposits?.reduce((sum, d) => sum + d.amount, 0) || 0,
      totalWithdrawals: user.withdrawals?.length || 0,
      totalWithdrawalAmount:
        user.withdrawals?.reduce((sum, w) => sum + w.amount, 0) || 0,
      totalLoanRepayments: user.loanRepayments?.length || 0,
      totalRepaymentAmount:
        user.loanRepayments?.reduce((sum, r) => sum + r.amount, 0) || 0,
      totalTransactions:
        (user.deposits?.length || 0) +
        (user.withdrawals?.length || 0) +
        (user.loanRepayments?.length || 0),
      floatBalance: user.userFloat?.balance || 0,
      reconciliationsApproved: user.approvedReconciliations?.length || 0,
    };

    return {
      error: null,
      data: {
        user,
        auditLogs,
        stats,
      },
    };
  } catch (error) {
    console.error("Error fetching detailed user data:", error);
    return {
      error: "Failed to fetch user data",
      data: null,
    };
  }
}

// Alternative: Get user statistics only
export async function getUserStatistics(userId: string) {
  try {
    const [
      depositCount,
      withdrawalCount,
      loanRepaymentCount,
      depositTotal,
      withdrawalTotal,
      repaymentTotal,
    ] = await Promise.all([
      db.deposit.count({ where: { handlerUserId: userId } }),
      db.withdrawal.count({ where: { handlerUserId: userId } }),
      db.loanRepayment.count({ where: { handlerUserId: userId } }),
      db.deposit.aggregate({
        where: { handlerUserId: userId },
        _sum: { amount: true },
      }),
      db.withdrawal.aggregate({
        where: { handlerUserId: userId },
        _sum: { amount: true },
      }),
      db.loanRepayment.aggregate({
        where: { handlerUserId: userId },
        _sum: { amount: true },
      }),
    ]);

    return {
      error: null,
      data: {
        deposits: {
          count: depositCount,
          total: depositTotal._sum.amount || 0,
        },
        withdrawals: {
          count: withdrawalCount,
          total: withdrawalTotal._sum.amount || 0,
        },
        loanRepayments: {
          count: loanRepaymentCount,
          total: repaymentTotal._sum.amount || 0,
        },
        totalTransactions: depositCount + withdrawalCount + loanRepaymentCount,
        totalAmount:
          (depositTotal._sum.amount || 0) +
          (withdrawalTotal._sum.amount || 0) +
          (repaymentTotal._sum.amount || 0),
      },
    };
  } catch (error) {
    console.error("Error fetching user statistics:", error);
    return {
      error: "Failed to fetch statistics",
      data: null,
    };
  }
}

// Get recent user activity
export async function getUserRecentActivity(
  userId: string,
  limit: number = 20,
) {
  try {
    const activities = await db.auditLog.findMany({
      where: {
        userId: userId,
      },
      orderBy: {
        timestamp: "desc",
      },
      take: limit,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        timestamp: true,
        details: true,
        ipAddress: true,
      },
    });

    return {
      error: null,
      data: activities,
    };
  } catch (error) {
    console.error("Error fetching user activity:", error);
    return {
      error: "Failed to fetch activity",
      data: null,
    };
  }
}
