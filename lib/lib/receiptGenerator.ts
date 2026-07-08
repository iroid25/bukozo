// utils/receiptGenerator.ts

import jsPDF from "jspdf";

interface ReceiptData {
  transactionRef: string;
  depositDate: string;
  memberName: string;
  memberNumber: string;
  accountNumber: string;
  accountType: string;
  amount: number;
  channel: string;
  mobileMoneyRef?: string;
  depositorName?: string;
  handlerName: string;
  branchName: string;
  branchLocation: string;
  description?: string;
}

export function generateDepositReceipt(data: ReceiptData) {
  const doc = new jsPDF();

  // Header
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(
    "BUKONZO UNITED TEACHERS’ COOPERATIVE SAVINGS AND CREDIT SOCIETY LTD",
    105,
    20,
    { align: "center" }
  );

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text("SACCO Management System", 105, 28, { align: "center" });

  // Line separator
  doc.setLineWidth(0.5);
  doc.line(20, 35, 190, 35);

  // Transaction Details Box
  doc.setFillColor(240, 240, 240);
  doc.rect(20, 40, 170, 15, "F");
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Transaction Reference:", 25, 48);
  doc.setFont("helvetica", "normal");
  doc.text(data.transactionRef, 80, 48);
  doc.setFont("helvetica", "bold");
  doc.text("Date:", 130, 48);
  doc.setFont("helvetica", "normal");
  doc.text(data.depositDate, 145, 48);

  // Member Information
  let yPos = 65;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("MEMBER INFORMATION", 20, yPos);

  yPos += 8;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  const memberInfo = [
    ["Member Name:", data.memberName],
    ["Member Number:", data.memberNumber],
    ["Account Number:", data.accountNumber],
    ["Account Type:", data.accountType],
  ];

  memberInfo.forEach(([label, value]) => {
    doc.setFont("helvetica", "bold");
    doc.text(label, 25, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(value, 80, yPos);
    yPos += 7;
  });

  // Depositor Information (if provided)
  if (data.depositorName) {
    yPos += 5;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("DEPOSITOR INFORMATION", 20, yPos);

    yPos += 8;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Deposited By:", 25, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(data.depositorName, 80, yPos);
    yPos += 7;
  }

  // Transaction Details
  yPos += 5;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("TRANSACTION DETAILS", 20, yPos);

  yPos += 8;
  doc.setFontSize(10);

  const transactionInfo: [string, string][] = [
    [
      "Amount:",
      `UGX ${data.amount.toLocaleString("en-UG", { minimumFractionDigits: 0 })}`,
    ],
    ["Payment Channel:", data.channel],
  ];

  if (data.mobileMoneyRef) {
    transactionInfo.push(["Mobile Money Ref:", data.mobileMoneyRef]);
  }

  if (data.description) {
    transactionInfo.push(["Description:", data.description]);
  }

  transactionInfo.forEach(([label, value]) => {
    doc.setFont("helvetica", "bold");
    doc.text(label, 25, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(value, 80, yPos);
    yPos += 7;
  });

  // Amount Box (Highlighted)
  yPos += 5;
  doc.setFillColor(34, 197, 94); // Green
  doc.rect(20, yPos, 170, 20, "F");
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text("AMOUNT DEPOSITED:", 25, yPos + 8);
  doc.setFontSize(16);
  doc.text(
    `UGX ${data.amount.toLocaleString("en-UG", { minimumFractionDigits: 0 })}`,
    25,
    yPos + 16
  );
  doc.setTextColor(0, 0, 0);

  // Branch & Handler Info
  yPos += 30;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Processed By:", 25, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(data.handlerName, 80, yPos);

  yPos += 7;
  doc.setFont("helvetica", "bold");
  doc.text("Branch:", 25, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(`${data.branchName} - ${data.branchLocation}`, 80, yPos);

  // Footer
  yPos += 20;
  doc.setLineWidth(0.5);
  doc.line(20, yPos, 190, yPos);

  yPos += 8;
  doc.setFontSize(9);
  doc.setFont("helvetica", "italic");
  doc.text(
    "This is a computer-generated receipt and does not require a signature.",
    105,
    yPos,
    { align: "center" }
  );

  yPos += 5;
  doc.text("Please keep this receipt for your records.", 105, yPos, {
    align: "center",
  });

  yPos += 8;
  doc.setFont("helvetica", "normal");
  doc.text(`Generated on: ${new Date().toLocaleString("en-UG")}`, 105, yPos, {
    align: "center",
  });

  // Save the PDF
  doc.save(`Deposit_Receipt_${data.transactionRef}.pdf`);
}
