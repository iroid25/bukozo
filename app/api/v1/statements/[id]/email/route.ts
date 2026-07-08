import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

/**
 * POST /api/v1/statements/[id]/email
 * Send statement via email
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const {
      recipientEmail,
      recipientName,
      memberNumber,
      periodStart,
      periodEnd,
      pdfBase64,
      filename,
    } = body;

    // Validate required fields
    if (!recipientEmail || !pdfBase64 || !filename) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate email
    if (!recipientEmail.includes("@")) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
    }

    // Format dates
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

    // Email HTML template (without emojis)
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              line-height: 1.6;
              color: #333;
              margin: 0;
              padding: 0;
              background-color: #f4f4f4;
            }
            .container {
              max-width: 600px;
              margin: 20px auto;
              background-color: white;
              border-radius: 8px;
              overflow: hidden;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .header {
              background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
              color: white;
              padding: 30px 20px;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
            }
            .content {
              padding: 30px;
            }
            .info-box {
              background-color: #f9fafb;
              padding: 20px;
              margin: 20px 0;
              border-left: 4px solid #2563eb;
              border-radius: 4px;
            }
            .info-box strong {
              display: block;
              margin-bottom: 10px;
              color: #1e40af;
            }
            .footer {
              background-color: #f9fafb;
              padding: 20px;
              text-align: center;
              border-top: 1px solid #e5e7eb;
              font-size: 13px;
              color: #6b7280;
            }
            .button {
              display: inline-block;
              padding: 12px 24px;
              background-color: #2563eb;
              color: white;
              text-decoration: none;
              border-radius: 6px;
              margin: 20px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>BUTSACCO Bank Statement</h1>
            </div>
            <div class="content">
              <p>Dear <strong>${recipientName}</strong>,</p>
              
              <p>Your bank statement for the requested period has been generated and is attached to this email.</p>
              
              <div class="info-box">
                <strong>Statement Period</strong>
                <p style="margin: 0;">
                  <strong>From:</strong> ${startDate}<br>
                  <strong>To:</strong> ${endDate}
                </p>
              </div>
              
              <div class="info-box">
                <strong>Member Information</strong>
                <p style="margin: 0;">
                  <strong>Member Number:</strong> #${memberNumber}<br>
                  <strong>Statement Date:</strong> ${new Date().toLocaleDateString("en-UG")}
                </p>
              </div>
              
              <p>Please find your statement attached as a PDF document. If you have any questions or concerns about the transactions shown, please don't hesitate to contact us.</p>
              
              <p style="margin-top: 30px;">Best regards,<br><strong>BUTSACCO Team</strong></p>
            </div>
            
            <div class="footer">
              <strong>BUTSACCO</strong>
              <p style="margin: 10px 0;">123 Main Street, Kampala, Uganda</p>
              <p style="margin: 5px 0;">Phone: +256 123 456 789 | Email: info@butsacco.com</p>
              <p style="margin-top: 15px; font-size: 11px;">
                &copy; ${new Date().getFullYear()} BUTSACCO. All rights reserved.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Plain text version
    const emailText = `
Dear ${recipientName},

Your bank statement for the requested period has been generated and is attached to this email.

STATEMENT PERIOD
From: ${startDate}
To: ${endDate}

MEMBER INFORMATION
Member Number: #${memberNumber}
Statement Date: ${new Date().toLocaleDateString("en-UG")}

Please find your statement attached as a PDF document.

If you have any questions, please contact us at:
Phone: +256 123 456 789
Email: info@butsacco.com

Best regards,
BUTSACCO Team

---
BUTSACCO
123 Main Street, Kampala, Uganda
© ${new Date().getFullYear()} BUTSACCO. All rights reserved.
    `;

    // Send email using Resend
    const result = await resend.emails.send({
      from: "BUTSACCO Statements <statements@butsacco.com>",
      to: recipientEmail,
      subject: `Bank Statement - ${startDate} to ${endDate}`,
      html: emailHtml,
      text: emailText,
      attachments: [
        {
          filename: filename,
          content: pdfBase64,
        },
      ],
    });

    // Optional: Log email send (only if table exists)
    try {
      await db.statementEmailLog.create({
        data: {
          statementId: id,
          recipientEmail,
          sentAt: new Date(),
          status: "SENT",
        },
      });
    } catch (logError) {
      // Silently fail if logging table doesn't exist
      console.log("Email logging skipped (table may not exist)");
    }

    return NextResponse.json({
      success: true,
      message: "Email sent successfully",
      data: result,
    });
  } catch (error: any) {
    console.error("Error sending email:", error);

    // Try to log failed attempt
    try {
      const { id } = await params;
      const body = await request.json();

      await db.statementEmailLog.create({
        data: {
          statementId: id,
          recipientEmail: body.recipientEmail || "unknown",
          sentAt: new Date(),
          status: "FAILED",
          errorMessage: error.message,
        },
      });
    } catch (logError) {
      // Silently fail if logging table doesn't exist
      console.log("Error logging skipped");
    }

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to send email",
      },
      { status: 500 }
    );
  }
}
