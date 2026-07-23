import { Resend } from "resend";

export const EMAIL_FROM =
  process.env.RESEND_FROM_EMAIL ||
  "Bukonz Sacco <info@bukonzounitedteacherscooperativesociety.com>";

export const EMAIL_ADDRESS = "info@bukonzounitedteacherscooperativesociety.com";

const apiKey = process.env.RESEND_API_KEY;
if (!apiKey) {
  console.warn(
    "⚠️ RESEND_API_KEY is missing. Email features will be disabled or logged to console.",
  );
}
const resend = apiKey ? new Resend(apiKey) : null;

export async function sendStatementEmail(
  memberEmail: string,
  memberName: string,
  statementPeriod: string,
  pdfUrl: string,
  fileName: string,
) {
  try {
    const emailContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #003366; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .footer { text-align: center; padding: 15px; font-size: 12px; color: #666; }
            .button { 
              background: #003366; 
              color: white; 
              padding: 12px 24px; 
              text-decoration: none; 
              border-radius: 5px; 
              display: inline-block; 
              margin: 15px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Your SACCO Bank Statement</h1>
            </div>
            <div class="content">
              <h2>Dear ${memberName},</h2>
              <p>Your bank statement for the period <strong>${statementPeriod}</strong> is now ready.</p>
              
              <p>You can download your statement using the link below:</p>
              <a href="${pdfUrl}" class="button" target="_blank">Download Statement</a>
              
              <p><strong>Statement Details:</strong></p>
              <ul>
                <li>Period: ${statementPeriod}</li>
                <li>Generated on: ${new Date().toLocaleDateString()}</li>
                <li>Format: PDF</li>
              </ul>
              
              <p>If you have any questions about your statement, please contact our customer service team.</p>
              
              <p>Thank you for banking with us!</p>
              
              <p>Best regards,<br>
              <strong>Your SACCO Bank Team</strong></p>
            </div>
            <div class="footer">
              <p>This is an automated message. Please do not reply to this email.</p>
              <p>© ${new Date().getFullYear()} Your SACCO Bank. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    if (!resend) {
      console.log("📨 [MOCK EMAIL] sendStatementEmail:", {
        memberEmail,
        memberName,
        statementPeriod,
        pdfUrl,
      });
      return { id: "mock_id", data: null, error: null };
    }

    const result = await resend.emails.send({
      from: EMAIL_FROM,
      // to: ""iradtu22@gmail.com",
      to: [memberEmail],
      subject: `Bank Statement - ${statementPeriod}`,
      html: emailContent,
      attachments: [
        {
          path: pdfUrl,
          filename: fileName,
        },
      ],
    });

    return result;
  } catch (error) {
    console.error("Error sending email:", error);
    throw new Error("Failed to send statement email");
  }
}

export async function sendLoanReminderEmail(
  memberEmail: string,
  memberName: string,
  loanProduct: string,
  amountDue: number,
  dueDate: string,
  currency: string = "UGX",
) {
  try {
    const formattedAmount = new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: currency,
    }).format(amountDue);

    const emailContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #003366; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .footer { text-align: center; padding: 15px; font-size: 12px; color: #666; }
            .warning { color: #d9534f; font-weight: bold; }
            .button { 
              background: #003366; 
              color: white; 
              padding: 12px 24px; 
              text-decoration: none; 
              border-radius: 5px; 
              display: inline-block; 
              margin: 15px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Loan Repayment Reminder</h1>
            </div>
            <div class="content">
              <h2>Dear ${memberName},</h2>
              <p>This is a friendly reminder that your loan repayment is due in <strong>5 days</strong>.</p>
              
              <div style="background: white; padding: 15px; border-radius: 5px; border-left: 4px solid #003366; margin: 20px 0;">
                <p><strong>Loan Product:</strong> ${loanProduct}</p>
                <p><strong>Amount Due:</strong> ${formattedAmount}</p>
                <p><strong>Due Date:</strong> ${dueDate}</p>
              </div>

              <p>Please ensure your account is funded or make a payment via Mobile Money / Bank Transfer before the due date to avoid penalties.</p>
              
              <a href="${process.env.NEXTAUTH_URL || "https://sacco.desishub.com"}/dashboard/loans" class="button">View Loan Details</a>
              
              <p>If you have already made this payment, please disregard this notice.</p>
              
              <p>Best regards,<br>
              <strong>Your SACCO Bank Team</strong></p>
            </div>
            <div class="footer">
              <p>This is an automated message. Please do not reply to this email.</p>
              <p>© ${new Date().getFullYear()} Your SACCO Bank. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    if (!resend) {
      console.log("📨 [MOCK EMAIL] sendLoanReminderEmail:", {
        memberEmail,
        memberName,
        loanProduct,
        amountDue,
      });
      return { id: "mock_id", data: null, error: null };
    }

    const result = await resend.emails.send({
      from: EMAIL_FROM,
      to: [memberEmail],
      // to: ""iradtu22@gmail.com", // Keeping logic consistent with existing, but using dynamic for this feature
      subject: `Loan Repayment Reminder - Due in 5 Days`,
      html: emailContent,
    });

    return result;
  } catch (error) {
    console.error("Error sending loan reminder email:", error);
    // Don't throw logic error here to prevent one failure stopping the whole batch
    return { error };
  }
}

export async function sendLoanApplicationEmail(
  memberEmail: string,
  memberName: string,
  loanProduct: string,
  amountApplied: number,
  currency: string = "UGX",
) {
  try {
    const formattedAmount = new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: currency,
    }).format(amountApplied);

    const emailContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #003366; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .footer { text-align: center; padding: 15px; font-size: 12px; color: #666; }
            .details { background: white; padding: 15px; border-radius: 5px; border-left: 4px solid #003366; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Loan Application Received</h1>
            </div>
            <div class="content">
              <h2>Dear ${memberName},</h2>
              <p>We have received your loan application. Our team is currently reviewing it.</p>
              
              <div class="details">
                <p><strong>Loan Product:</strong> ${loanProduct}</p>
                <p><strong>Amount Applied:</strong> ${formattedAmount}</p>
                <p><strong>Status:</strong> PENDING</p>
                <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
              </div>

              <p>We will notify you once a decision has been made.</p>
              
              <p>Best regards,<br>
              <strong>Your SACCO Bank Team</strong></p>
            </div>
            <div class="footer">
              <p>This is an automated message. Please do not reply to this email.</p>
              <p>© ${new Date().getFullYear()} Your SACCO Bank. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    if (!resend) {
      console.log("📨 [MOCK EMAIL] sendLoanApplicationEmail:", {
        memberEmail,
        memberName,
        loanProduct,
        amountApplied,
      });
      return { id: "mock_id", data: null, error: null };
    }

    return await resend.emails.send({
      from: EMAIL_FROM,
      to: [memberEmail],
      subject: `Loan Application Received - ${loanProduct}`,
      html: emailContent,
    });
  } catch (error) {
    console.error("Error sending loan application email:", error);
    return { error };
  }
}

export async function sendLoanApprovalEmail(
  memberEmail: string,
  memberName: string,
  loanProduct: string,
  amountGranted: number,
  currency: string = "UGX",
) {
  try {
    const formattedAmount = new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: currency,
    }).format(amountGranted);

    const emailContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #28a745; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .footer { text-align: center; padding: 15px; font-size: 12px; color: #666; }
            .details { background: white; padding: 15px; border-radius: 5px; border-left: 4px solid #28a745; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Loan Approved!</h1>
            </div>
            <div class="content">
              <h2>Congratulations ${memberName},</h2>
              <p>Your loan application has been approved.</p>
              
              <div class="details">
                <p><strong>Loan Product:</strong> ${loanProduct}</p>
                <p><strong>Amount Granted:</strong> ${formattedAmount}</p>
                <p><strong>Status:</strong> APPROVED</p>
              </div>

              <p>The funds will be disbursed to your account shortly.</p>
              
              <p>Best regards,<br>
              <strong>Your SACCO Bank Team</strong></p>
            </div>
            <div class="footer">
              <p>This is an automated message. Please do not reply to this email.</p>
              <p>© ${new Date().getFullYear()} Your SACCO Bank. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    if (!resend) {
      console.log("📨 [MOCK EMAIL] sendLoanApprovalEmail:", {
        memberEmail,
        memberName,
        loanProduct,
        amountGranted,
      });
      return { id: "mock_id", data: null, error: null };
    }

    return await resend.emails.send({
      from: EMAIL_FROM,
      to: [memberEmail],
      subject: `Loan Application Approved - ${loanProduct}`,
      html: emailContent,
    });
  } catch (error) {
    console.error("Error sending loan approval email:", error);
    return { error };
  }
}

export async function sendWithdrawalPasscodeEmail(
  memberEmail: string,
  memberName: string,
  passcode: string,
) {
  try {
    const emailContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #003366; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .footer { text-align: center; padding: 15px; font-size: 12px; color: #666; }
            .passcode { font-size: 32px; font-weight: bold; color: #003366; text-align: center; margin: 30px 0; letter-spacing: 5px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Withdrawal Passcode</h1>
            </div>
            <div class="content">
              <h2>Hello ${memberName},</h2>
              <p>Use the following passcode to complete your withdrawal request. This code is valid for a limited time.</p>
              
              <div class="passcode">${passcode}</div>

              <p>If you did not initiate this request, please contact us immediately.</p>
              
              <p>Best regards,<br>
              <strong>Your SACCO Bank Team</strong></p>
            </div>
            <div class="footer">
              <p>This is an automated message. Please do not reply to this email.</p>
              <p>© ${new Date().getFullYear()} Your SACCO Bank. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    if (!resend) {
      console.log("📨 [MOCK EMAIL] sendWithdrawalPasscodeEmail:", {
        memberEmail,
        memberName,
        passcode,
      });
      return { id: "mock_id", data: null, error: null };
    }

    return await resend.emails.send({
      from: EMAIL_FROM,
      to: [memberEmail],
      subject: `Withdrawal Passcode - ${passcode}`,
      html: emailContent,
    });
  } catch (error) {
    console.error("Error sending withdrawal passcode email:", error);
    return { error };
  }
}

export async function sendTransactionAlertEmail(
  memberEmail: string,
  memberName: string,
  transactionType: "DEPOSIT" | "WITHDRAWAL" | "DISBURSEMENT" | "REPAYMENT",
  amount: number,
  balance?: number,
  currency: string = "UGX",
) {
  try {
    const formattedAmount = new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: currency,
    }).format(amount);

    const formattedBalance =
      balance !== undefined
        ? new Intl.NumberFormat("en-UG", {
            style: "currency",
            currency: currency,
          }).format(balance)
        : null;

    const typeLabel =
      transactionType.charAt(0) + transactionType.slice(1).toLowerCase();

    const emailContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #003366; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .footer { text-align: center; padding: 15px; font-size: 12px; color: #666; }
            .details { background: white; padding: 15px; border-radius: 5px; border-left: 4px solid #003366; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Transaction Alert: ${typeLabel}</h1>
            </div>
            <div class="content">
              <h2>Dear ${memberName},</h2>
              <p>This is to notify you of a ${typeLabel.toLowerCase()} on your account.</p>
              
              <div class="details">
                <p><strong>Transaction Type:</strong> ${typeLabel}</p>
                <p><strong>Amount:</strong> ${formattedAmount}</p>
                ${formattedBalance ? `<p><strong>Available Balance:</strong> ${formattedBalance}</p>` : ""}
                <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
              </div>

              <p>Thank you for banking with us!</p>
              
              <p>Best regards,<br>
              <strong>Your SACCO Bank Team</strong></p>
            </div>
            <div class="footer">
              <p>This is an automated message. Please do not reply to this email.</p>
              <p>© ${new Date().getFullYear()} Your SACCO Bank. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    if (!resend) {
      console.log("📨 [MOCK EMAIL] sendTransactionAlertEmail:", {
        memberEmail,
        memberName,
        transactionType,
        amount,
      });
      return { id: "mock_id", data: null, error: null };
    }

    return await resend.emails.send({
      from: EMAIL_FROM,
      to: [memberEmail],
      subject: `Transaction Alert: ${typeLabel} - ${formattedAmount}`,
      html: emailContent,
    });
  } catch (error) {
    console.error("Error sending transaction alert email:", error);
    return { error };
  }
}
