// @ts-nocheck
"use server";

import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// Interface for email sending
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

// Debug function - remove this after testing
export async function debugUserFetch() {
  try {
    console.log("Testing database connection...");

    const totalUsers = await db.user.count();
    console.log(`Total users in database: ${totalUsers}`);

    const activeUsers = await db.user.count({
      where: { isActive: true },
    });
    console.log(`Active users: ${activeUsers}`);

    const sampleUsers = await db.user.findMany({
      take: 3,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
      },
    });
    console.log("Sample users:", sampleUsers);

    return {
      totalUsers,
      activeUsers,
      sampleUsers,
    };
  } catch (error) {
    console.error("Debug fetch error:", error);
    throw error;
  }
}

// Get all users with emails for bulk email
export async function getAllUsersForEmail() {
  try {
    const users = await db.user.findMany({
      where: {
        isActive: true,
        // email is required in your schema, so no need to filter for null
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

    console.log(`Found ${users.length} active users for email`);
    return users;
  } catch (error) {
    console.error("Error fetching users for email:", error);
    throw new Error(`Database error: ${error.message}`);
  }
}

// Send bulk emails
export async function sendBulkEmail({
  recipients,
  subject,
  message,
}: SendEmailParams): Promise<EmailResult> {
  try {
    // Check authentication
    const user = await getAuthUser();

    if (!user || (user.role !== "ADMIN" && user.role !== "BRANCHMANAGER")) {
      throw new Error("Unauthorized");
    }

    // Validate input
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      throw new Error("Recipients are required");
    }

    if (!subject || !message) {
      throw new Error("Subject and message are required");
    }

    console.log(`Sending emails to ${recipients.length} recipients`);

    // Send emails in batches to avoid rate limits
    const batchSize = 10;
    const results = [];

    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);

      const batchResults = await Promise.allSettled(
        batch.map(async (email: string) => {
          try {
            const result = await resend.emails.send({
              from: " bukonzo Teachers SACCO <info@maripatechagency.com> ", // Using your existing verified domain
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
                        If you have any questions, please contact us at info@maripatechagency.com
                      </p>
                    </div>
                  </div>
                </div>
              `,
              text: `${subject}\n\n${message}\n\n---\nThis email was sent from  bukonzo Teachers SACCO`, // Plain text fallback
            });
            return { success: true, email, result };
          } catch (error: any) {
            console.error(`Failed to send email to ${email}:`, error);
            return { success: false, email, error: error.message };
          }
        }),
      );

      results.push(...batchResults);

      // Add small delay between batches to avoid rate limits
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

    // Log email activity for audit trail
    try {
      await db.notification.createMany({
        data: recipients.map((email) => ({
          type: "EMAIL",
          message: `${subject}: ${message}`,
          targetAddress: email,
          sentAt: new Date(),
          status: "SENT", // You might want to track individual statuses
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
