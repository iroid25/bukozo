"use server";

import { db } from "@/prisma/db";
import { Statement, StatementData } from "@/types/statements"; // Add this import
import { getAuthUser } from "@/config/useAuth";
import { getAccessibleStatementById } from "@/services/report.service";
/**
 * Generate a PDF statement for a member
 * This is a placeholder function that would be replaced with actual PDF generation logic
 */
export async function generatePdfStatement(
  memberId: string,
  startDate: Date, // ✅ Changed from periodStart
  endDate: Date // ✅ Changed from periodEnd
): Promise<string> {
  try {
    // In a real implementation, you would:
    // 1. Fetch all transactions for the member within the date range
    const transactions = await db.transaction.findMany({
      where: {
        memberId,
        transactionDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        account: {
          include: {
            accountType: true,
          },
        },
      },
      orderBy: {
        transactionDate: "asc",
      },
    });

    // 2. Fetch member details
    const member = await db.member.findUnique({
      where: { id: memberId },
      include: {
        user: true,
        accounts: {
          include: {
            accountType: true,
          },
        },
      },
    });

    if (!member) {
      throw new Error("Member not found");
    }

    // 3. Fetch deposits within the period
    const deposits = await db.deposit.findMany({
      where: {
        memberId,
        depositDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        account: {
          include: {
            accountType: true,
          },
        },
      },
    });

    // 4. Fetch withdrawals within the period
    const withdrawals = await db.withdrawal.findMany({
      where: {
        memberId,
        withdrawalDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        account: {
          include: {
            accountType: true,
          },
        },
      },
    });

    // 5. Fetch loan repayments within the period
    const loanRepayments = await db.loanRepayment.findMany({
      where: {
        memberId,
        repaymentDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        loan: {
          include: {
            loanApplication: {
              include: {
                loanProduct: true,
              },
            },
          },
        },
      },
    });

    // 6. Fetch loans disbursed within the period
    const loans = await db.loan.findMany({
      where: {
        memberId,
        disbursementDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        loanApplication: {
          include: {
            loanProduct: true,
          },
        },
      },
    });

    // 7. Generate a PDF using a library like PDFKit, jsPDF, or Puppeteer
    // This is just a placeholder - in a real app you would generate an actual PDF
    const fileName = `statement-${member.memberNumber}-${startDate.toISOString().split("T")[0]}-${endDate.toISOString().split("T")[0]}.pdf`;

    // 8. Save the PDF to a storage service or file system
    // In production, you would upload to AWS S3, Cloudinary, etc.
    const pdfPath = `/statements/${fileName}`; // ✅ Changed from fileUrl

    // You could also generate the actual PDF here using libraries like:
    // - jsPDF: for client-side PDF generation
    // - PDFKit: for server-side PDF generation
    // - Puppeteer: for HTML-to-PDF conversion
    // - React-PDF: for React-based PDF generation

    // Example with PDFKit (pseudo-code):
    /*
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument();
    doc.pipe(fs.createWriteStream(pdfPath));
    
    // Header
    doc.fontSize(20).text('Account Statement', { align: 'center' });
    doc.fontSize(12).text(`Member: ${member.user.name}`);
    doc.text(`Period: ${startDate.toDateString()} - ${endDate.toDateString()}`);
    
    // Transactions table
    transactions.forEach(txn => {
      doc.text(`${txn.transactionDate.toDateString()} - ${txn.description} - ${txn.amount}`);
    });
    
    doc.end();
    */

    // Return the path to the generated PDF
    return pdfPath;
  } catch (error) {
    console.error("Failed to generate PDF statement:", error);
    throw new Error("Failed to generate PDF statement");
  }
}

/**
 * Download a statement
 * This would typically be used in an API route to serve the PDF file
 */
export async function downloadStatement(
  statementId: string
): Promise<{ url: string; filename: string }> {
  try {
    const statement = await db.statement.findUnique({
      where: { id: statementId },
      include: {
        member: true,
      },
    });

    if (!statement || !statement.pdfPath) {
      // ✅ Changed from fileUrl
      throw new Error("Statement not found or PDF not generated");
    }

    // In a real app, you might need to generate a signed URL if the file is stored in cloud storage
    // Example with AWS S3:
    /*
    const s3 = new AWS.S3();
    const signedUrl = s3.getSignedUrl('getObject', {
      Bucket: 'your-bucket',
      Key: statement.pdfPath,
      Expires: 3600 // URL expires in 1 hour
    });
    return { url: signedUrl, filename: ... };
    */

    return {
      url: statement.pdfPath, // ✅ Changed from fileUrl
      filename: `Statement-${statement.member.memberNumber}-${statement.startDate.toISOString().split("T")[0]}.pdf`, // ✅ Changed from periodStart
    };
  } catch (error) {
    console.error("Failed to download statement:", error);
    throw new Error("Failed to download statement");
  }
}

/**
 * Get statement data for preview or email
 */
export async function getStatementData(statementId: string) {
  try {
    const statement = await db.statement.findUnique({
      where: { id: statementId },
      include: {
        member: {
          include: {
            user: true,
            accounts: {
              include: {
                accountType: true,
              },
            },
          },
        },
        user: {
          select: {
            name: true,
            role: true,
          },
        },
      },
    });

    if (!statement) {
      throw new Error("Statement not found");
    }

    // Get all transactions within the statement period
    const transactions = await db.transaction.findMany({
      where: {
        memberId: statement.memberId,
        transactionDate: {
          gte: statement.startDate,
          lte: statement.endDate || new Date(),
        },
      },
      include: {
        account: {
          include: {
            accountType: true,
          },
        },
      },
      orderBy: {
        transactionDate: "asc",
      },
    });

    // Get deposits
    const deposits = await db.deposit.findMany({
      where: {
        memberId: statement.memberId,
        depositDate: {
          gte: statement.startDate,
          lte: statement.endDate || new Date(),
        },
      },
      include: {
        account: {
          include: {
            accountType: true,
          },
        },
      },
    });

    // Get withdrawals
    const withdrawals = await db.withdrawal.findMany({
      where: {
        memberId: statement.memberId,
        withdrawalDate: {
          gte: statement.startDate,
          lte: statement.endDate || new Date(),
        },
      },
      include: {
        account: {
          include: {
            accountType: true,
          },
        },
      },
    });

    // Get loan repayments
    const loanRepayments = await db.loanRepayment.findMany({
      where: {
        memberId: statement.memberId,
        repaymentDate: {
          gte: statement.startDate,
          lte: statement.endDate || new Date(),
        },
      },
      include: {
        loan: true,
      },
    });

    // Calculate totals
    const totalDeposits = deposits.reduce((sum, d) => sum + d.amount, 0);
    const totalWithdrawals = withdrawals.reduce((sum, w) => sum + w.amount, 0);
    const totalRepayments = loanRepayments.reduce(
      (sum, r) => sum + r.amount,
      0
    );

    return {
      statement,
      transactions,
      deposits,
      withdrawals,
      loanRepayments,
      totals: {
        deposits: totalDeposits,
        withdrawals: totalWithdrawals,
        repayments: totalRepayments,
        netChange: totalDeposits - totalWithdrawals,
      },
    };
  } catch (error) {
    console.error("Failed to get statement data:", error);
    throw new Error("Failed to get statement data");
  }
}

/**
 * Check if a statement exists for a member and period
 */
export async function checkStatementExists(
  memberId: string,
  startDate: Date,
  endDate: Date
): Promise<boolean> {
  try {
    const statement = await db.statement.findFirst({
      where: {
        memberId,
        startDate,
        endDate,
      },
    });

    return !!statement;
  } catch (error) {
    console.error("Failed to check statement existence:", error);
    return false;
  }
}

/**
 * Regenerate a statement PDF
 */
export async function regenerateStatementPdf(statementId: string) {
  try {
    const statement = await db.statement.findUnique({
      where: { id: statementId },
      include: {
        member: true,
      },
    });

    if (!statement) {
      throw new Error("Statement not found");
    }

    // Generate new PDF
    const newPdfPath = await generatePdfStatement(
      statement.memberId,
      statement.startDate,
      statement.endDate || new Date()
    );

    // Update statement with new PDF path
    const updatedStatement = await db.statement.update({
      where: { id: statementId },
      data: {
        pdfPath: newPdfPath,
      },
    });

    return {
      success: true,
      data: updatedStatement,
    };
  } catch (error) {
    console.error("Failed to regenerate statement PDF:", error);
    return {
      success: false,
      error: "Failed to regenerate statement PDF",
    };
  }
}

/**
 * Email a statement to a member
 */
export async function emailStatement(statementId: string) {
  try {
    const statement = await db.statement.findUnique({
      where: { id: statementId },
      include: {
        member: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!statement) {
      throw new Error("Statement not found");
    }

    if (!statement.member.user.email) {
      throw new Error("Member does not have an email address");
    }

    // In a real app, you would use an email service like:
    // - SendGrid
    // - AWS SES
    // - Resend
    // - Nodemailer

    // Example (pseudo-code):
    /*
    await sendEmail({
      to: statement.member.user.email,
      subject: `Account Statement - ${statement.startDate.toDateString()}`,
      body: `Dear ${statement.member.user.name},\n\nPlease find attached your account statement.`,
      attachments: [
        {
          filename: `statement-${statement.member.memberNumber}.pdf`,
          path: statement.pdfPath,
        },
      ],
    });
    */

    // Log the email notification
    await db.notification.create({
      data: {
        userId: statement.member.userId,
        type: "EMAIL",
        subject: "Account Statement",
        message: `Your account statement for the period ${statement.startDate.toDateString()} to ${statement.endDate?.toDateString() || "present"} has been sent to your email.`,
        targetAddress: statement.member.user.email,
        status: "SENT",
      },
    });

    return {
      success: true,
      message: "Statement sent successfully",
    };
  } catch (error) {
    console.error("Failed to email statement:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to email statement",
    };
  }
}
/**
 * Get a statement by ID
 */
export async function getStatementById(
  statementId: string
): Promise<Statement | null> {
  try {
    const user = await getAuthUser();
    if (!user) {
      return null;
    }

    const statement = await getAccessibleStatementById(user, statementId);

    if (!statement) {
      return null;
    }

    // Transform to match Statement interface with computed properties
    return {
      ...statement,
      // Add computed/alias properties for backward compatibility
      statementDate: statement.generatedAt,
      periodStart: statement.startDate,
      periodEnd: statement.endDate || new Date(),
      fileUrl: statement.pdfPath,
      generatedByUserId: statement.userId,
      generatedByUser: statement.user
        ? {
            id: statement.user.id,
            name: statement.user.name,
            role: statement.user.role,
          }
        : null,
    } as any;
  } catch (error) {
    console.error("Failed to get statement by ID:", error);
    throw new Error("Failed to get statement");
  }
}
/**
 * Get member statement data for a specific period
 */
export async function getMemberStatementData(
  memberId: string,
  startDate: Date,
  endDate: Date
): Promise<StatementData> {
  try {
    const member = await db.member.findUnique({
      where: { id: memberId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            address: true,
          },
        },
        accounts: {
          include: {
            accountType: true,
            branch: true,
          },
        },
      },
    });

    if (!member) {
      throw new Error("Member not found");
    }

    // Get all transactions within the period
    const transactions = await db.transaction.findMany({
      where: {
        memberId,
        transactionDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        account: {
          include: {
            accountType: true,
          },
        },
        processedByUser: {
          select: {
            name: true,
            role: true,
          },
        },
      },
      orderBy: {
        transactionDate: "desc",
      },
    });

    // Get deposits
    const deposits = await db.deposit.findMany({
      where: {
        memberId,
        depositDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        account: {
          include: {
            accountType: true,
          },
        },
        handler: {
          select: {
            name: true,
            role: true,
          },
        },
      },
      orderBy: {
        depositDate: "desc",
      },
    });

    // Get withdrawals
    const withdrawals = await db.withdrawal.findMany({
      where: {
        memberId,
        withdrawalDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        account: {
          include: {
            accountType: true,
          },
        },
        handler: {
          select: {
            name: true,
            role: true,
          },
        },
      },
      orderBy: {
        withdrawalDate: "desc",
      },
    });

    // Get loan repayments
    const loanRepayments = await db.loanRepayment.findMany({
      where: {
        memberId,
        repaymentDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        loan: {
          include: {
            loanApplication: {
              include: {
                loanProduct: true,
              },
            },
          },
        },
        handler: {
          select: {
            name: true,
            role: true,
          },
        },
      },
      orderBy: {
        repaymentDate: "desc",
      },
    });

    // Get account balances
    const accountBalances = member.accounts.map((account) => ({
      id: account.id,
      accountNumber: account.accountNumber,
      currentBalance: account.balance,
      accountType: {
        id: account.accountType.id,
        name: account.accountType.name,
      },
      branch: {
        id: account.branch.id,
        name: account.branch.name,
        location: account.branch.location,
      },
    }));

    return {
      member: {
        id: member.id,
        memberNumber: member.memberNumber,
        user: member.user,
        accounts: member.accounts.map((account) => ({
          id: account.id,
          accountNumber: account.accountNumber,
          balance: account.balance,
          accountType: {
            id: account.accountType.id,
            name: account.accountType.name,
          },
          branch: {
            id: account.branch.id,
            name: account.branch.name,
            location: account.branch.location,
          },
        })),
      },
      transactions,
      deposits,
      withdrawals,
      loanRepayments,
      accountBalances,
    };
  } catch (error) {
    console.error("Failed to get member statement data:", error);
    throw new Error("Failed to get member statement data");
  }
}
// actions/statement-actions.ts (Add this function to your existing file)

import { Resend } from "resend"; // or your email service
// If using nodemailer instead:
// import nodemailer from "nodemailer";

const resend = new Resend(process.env.RESEND_API_KEY);

// If using nodemailer:
// const transporter = nodemailer.createTransport({
//   host: process.env.SMTP_HOST,
//   port: parseInt(process.env.SMTP_PORT || "587"),
//   secure: process.env.SMTP_SECURE === "true",
//   auth: {
//     user: process.env.SMTP_USER,
//     pass: process.env.SMTP_PASS,
//   },
// });

interface SendStatementEmailParams {
  statementId: string;
  recipientEmail: string;
  recipientName: string;
  memberNumber: string;
  periodStart: Date;
  periodEnd: Date;
  pdfBase64: string;
  filename: string;
}

export async function sendStatementEmail(params: SendStatementEmailParams) {
  try {
    const {
      statementId,
      recipientEmail,
      recipientName,
      memberNumber,
      periodStart,
      periodEnd,
      pdfBase64,
      filename,
    } = params;

    // Format dates for email
    const startDate = new Date(periodStart).toLocaleDateString("en-UG", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const endDate = new Date(periodEnd).toLocaleDateString("en-UG", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Email HTML template
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background-color: #2563eb;
              color: white;
              padding: 20px;
              text-align: center;
              border-radius: 8px 8px 0 0;
            }
            .content {
              background-color: #f9fafb;
              padding: 30px;
              border-radius: 0 0 8px 8px;
            }
            .info-box {
              background-color: white;
              padding: 15px;
              margin: 15px 0;
              border-left: 4px solid #2563eb;
              border-radius: 4px;
            }
            .footer {
              text-align: center;
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              color: #6b7280;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>BUTSACCO Bank Statement</h1>
            </div>
            <div class="content">
              <p>Dear ${recipientName},</p>
              
              <p>Please find attached your bank statement for the period:</p>
              
              <div class="info-box">
                <strong>Statement Period:</strong><br>
                ${startDate} to ${endDate}
              </div>
              
              <div class="info-box">
                <strong>Member Number:</strong> ${memberNumber}<br>
                <strong>Statement Date:</strong> ${new Date().toLocaleDateString(
                  "en-UG",
                  {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  }
                )}
              </div>
              
              <p>This statement includes details of all transactions, deposits, withdrawals, and account balances for the specified period.</p>
              
              <p>If you have any questions or concerns about this statement, please don't hesitate to contact us.</p>
              
              <p>Best regards,<br>
              <strong>BUTSACCO Team</strong></p>
              
              <div class="footer">
                <p>
                  BUTSACCO | 123 Main Street, Kampala, Uganda<br>
                  Phone: +256 123 456 789 | Email: info@butsacco.com
                </p>
                <p style="margin-top: 10px;">
                  This is an automated email. Please do not reply to this message.
                </p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    // Using Resend
    const result = await resend.emails.send({
      from: "BUTSACCO <statements@butsacco.com>",
      to: recipientEmail,
      subject: `Bank Statement - ${startDate} to ${endDate}`,
      html: emailHtml,
      attachments: [
        {
          filename: filename,
          content: pdfBase64,
        },
      ],
    });

    // If using nodemailer instead:
    // const result = await transporter.sendMail({
    //   from: '"BUTSACCO" <statements@butsacco.com>',
    //   to: recipientEmail,
    //   subject: `Bank Statement - ${startDate} to ${endDate}`,
    //   html: emailHtml,
    //   attachments: [
    //     {
    //       filename: filename,
    //       content: Buffer.from(pdfBase64, "base64"),
    //     },
    //   ],
    // });

    // Log the email send in database (optional)
    await db.statementEmailLog.create({
      data: {
        statementId,
        recipientEmail,
        sentAt: new Date(),
        status: "SENT",
      },
    });

    return {
      success: true,
      data: result,
    };
  } catch (error: any) {
    console.error("Error sending statement email:", error);

    // Log failed email attempt (optional)
    try {
      await db.statementEmailLog.create({
        data: {
          statementId: params.statementId,
          recipientEmail: params.recipientEmail,
          sentAt: new Date(),
          status: "FAILED",
          errorMessage: error.message,
        },
      });
    } catch (logError) {
      console.error("Error logging email failure:", logError);
    }

    return {
      success: false,
      error: error.message || "Failed to send email",
    };
  }
}
