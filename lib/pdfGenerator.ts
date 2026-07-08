// lib/pdfGenerator.ts
import { StatementData } from "@/types/statements";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { REPORT_HEADER_DETAILS } from "@/lib/report-header";

export interface PDFStatementOptions {
  data: StatementData;
  periodStart: Date;
  periodEnd: Date;
  logoUrl?: string;
  organizationName?: string;
  organizationAddress?: string;
  organizationPhone?: string;
  organizationEmail?: string;
}

export interface PDFReceiptOptions {
  transaction: any;
  organizationName?: string;
  organizationAddress?: string;
  organizationPhone?: string;
  organizationEmail?: string;
}

/**
 * Generates a PDF receipt for a transaction
 */
export async function generateTransactionReceiptPDF(
  options: PDFReceiptOptions
): Promise<Buffer> {
  const {
    transaction,
    organizationName = REPORT_HEADER_DETAILS.institutionName,
    organizationAddress = REPORT_HEADER_DETAILS.postalAddress.join(", "),
    organizationPhone = REPORT_HEADER_DETAILS.contacts.join(" / "),
    organizationEmail = REPORT_HEADER_DETAILS.email,
  } = options;

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a5", // Receipts are usually smaller
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header
  doc.setFontSize(15);
  doc.setTextColor(44, 62, 80);
  doc.text(organizationName, pageWidth / 2, 15, { align: "center" });
  
  doc.setFontSize(8);
  doc.setTextColor(127, 140, 141);
  doc.text(REPORT_HEADER_DETAILS.registrationNumber, pageWidth / 2, 20, { align: "center" });
  doc.text(organizationAddress, pageWidth / 2, 24, { align: "center" });
  doc.text(`${organizationPhone} | ${organizationEmail}`, pageWidth / 2, 28, { align: "center" });
  
  doc.setDrawColor(44, 62, 80);
  doc.setLineWidth(0.5);
  doc.line(10, 32, pageWidth - 10, 32);

  // Title
  doc.setFontSize(14);
  doc.setTextColor(44, 62, 80);
  doc.text("OFFICIAL TRANSACTION RECEIPT", pageWidth / 2, 42, { align: "center" });

  // Transaction Info
  doc.setFontSize(10);
  doc.setTextColor(51, 51, 51);
  
  const startY = 52;
  const col1 = 15;
  const col2 = 60;
  
  doc.setFont("helvetica", "bold");
  doc.text("Reference:", col1, startY);
  doc.setFont("helvetica", "normal");
  doc.text(transaction.transactionRef, col2, startY);

  doc.setFont("helvetica", "bold");
  doc.text("Date:", col1, startY + 7);
  doc.setFont("helvetica", "normal");
  doc.text(new Date(transaction.transactionDate).toLocaleString(), col2, startY + 7);

  doc.setFont("helvetica", "bold");
  doc.text("Member:", col1, startY + 14);
  doc.setFont("helvetica", "normal");
  const memberName = transaction.member?.user?.name || transaction.institution?.institutionName || "Walk-in Client";
  doc.text(memberName, col2, startY + 14);

  doc.setFont("helvetica", "bold");
  doc.text("Account No:", col1, startY + 21);
  doc.setFont("helvetica", "normal");
  doc.text(transaction.account?.accountNumber || "N/A", col2, startY + 21);

  doc.setFont("helvetica", "bold");
  doc.text("Type:", col1, startY + 28);
  doc.setFont("helvetica", "normal");
  doc.text(transaction.type.replace(/_/g, " "), col2, startY + 28);

  // Amount Highlight
  doc.setFillColor(245, 247, 248);
  doc.rect(10, startY + 35, pageWidth - 20, 15, "F");
  
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("AMOUNT:", 20, startY + 45);
  doc.setTextColor(39, 174, 96); // Green
  doc.text(`UGX ${transaction.amount.toLocaleString()}`, 60, startY + 45);
  doc.setTextColor(51, 51, 51);

  // Details Table (optional)
  if (transaction.loanId) {
     doc.setFontSize(9);
     doc.setFont("helvetica", "italic");
     doc.text(`Note: Loan Repayment for Loan ID: ${transaction.loanId.slice(0, 8)}`, col1, startY + 60);
  }

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 20;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(127, 140, 141);
  doc.text("This is a system generated receipt and does not require a physical signature.", pageWidth / 2, footerY, { align: "center" });
  doc.text(`Generated on: ${new Date().toLocaleString()}`, pageWidth / 2, footerY + 5, { align: "center" });
  doc.text("Thank you for banking with us!", pageWidth / 2, footerY + 10, { align: "center" });

  return Buffer.from(doc.output("arraybuffer"));
}

export async function generateStatementPDF(
  options: PDFStatementOptions
): Promise<string> {
  const {
    data,
    periodStart,
    periodEnd,
    organizationName = "SACCO Bank",
  } = options;

  // Mock PDF generation for legacy compatibility
  console.log(
    "Generating PDF for statement subject:",
    data.member?.user.name || data.institution?.institutionName || "Unknown",
  );
  return `/api/statements/pdf/mock_statement.pdf`;
}

// HTML template for PDF generation (for potential server-side rendering or printing)
export function generateReceiptHTML(
  transaction: any,
  options: PDFReceiptOptions
): string {
  const {
    organizationName = REPORT_HEADER_DETAILS.institutionName,
    organizationAddress = REPORT_HEADER_DETAILS.postalAddress.join(", "),
    organizationPhone = REPORT_HEADER_DETAILS.contacts.join(" / "),
  } = options;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: sans-serif; padding: 40px; color: #333; }
            .receipt { border: 1px solid #ddd; padding: 20px; max-width: 500px; margin: auto; }
            .header { text-align: center; border-bottom: 2px solid #2c3e50; padding-bottom: 10px; }
            .title { font-size: 20px; font-bold; margin: 20px 0; text-align: center; }
            .row { display: flex; justify-content: space-between; margin: 10px 0; border-bottom: 1px solid #eee; padding-bottom: 5px; }
            .amount { font-size: 24px; font-weight: bold; color: #27ae60; text-align: center; margin: 20px 0; background: #f9f9f9; padding: 15px; }
            .footer { text-align: center; font-size: 12px; color: #7f8c8d; margin-top: 30px; }
        </style>
    </head>
    <body>
        <div class="receipt">
            <div class="header">
                <h2>${organizationName}</h2>
                <p>${organizationAddress}</p>
                <p>${organizationPhone}</p>
            </div>
            <div class="title">OFFICIAL RECEIPT</div>
            <div class="row"><span>Reference:</span> <strong>${transaction.transactionRef}</strong></div>
            <div class="row"><span>Date:</span> <span>${new Date(transaction.transactionDate).toLocaleString()}</span></div>
            <div class="row"><span>Member:</span> <span>${transaction.member?.user?.name || "N/A"}</span></div>
            <div class="row"><span>Type:</span> <span>${transaction.type}</span></div>
            <div class="amount">${formatCurrency(transaction.amount)}</div>
            <div class="footer">
                <p>Thank you for choosing ${organizationName}!</p>
                <p>Generated on ${new Date().toLocaleString()}</p>
            </div>
        </div>
    </body>
    </html>
  `;
}
