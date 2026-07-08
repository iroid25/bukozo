import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { StatementData } from '@/types/statements';

export async function generateMemberStatementPDF(data: StatementData, startDate: Date, endDate: Date): Promise<Buffer> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;

  // Header - SACCO Info
  doc.setFontSize(22);
  doc.setTextColor(30, 58, 138); // Indigo 900
  doc.text('Bukonzo Teachers SACCO', 14, 20);
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text('Empowering Teachers for a Better Future', 14, 26);
  doc.text('PO Box 123, Bwera, Uganda', 14, 31);
  doc.text('Phone: +256 700 000000 | Email: info@bukonzoteachersacco.com', 14, 36);

  // Statement Info
  doc.setFontSize(16);
  doc.setTextColor(0);
  const isInstitution = data.subjectType === "INSTITUTION";
  const subjectName = isInstitution
    ? data.institution?.institutionName || "Institution"
    : data.member?.user.name || "Member";
  const subjectReference = isInstitution
    ? data.institution?.institutionNumber || "N/A"
    : data.member?.memberNumber || "N/A";

  doc.text(isInstitution ? 'INSTITUTION ACCOUNT STATEMENT' : 'MEMBER ACCOUNT STATEMENT', 14, 50);
  
  doc.setFontSize(10);
  doc.text(`Statement Period: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`, 14, 57);
  doc.text(`Generated At: ${new Date().toLocaleString()}`, 14, 62);

  // Member Details
  doc.setDrawColor(229, 231, 235);
  doc.line(14, 68, pageWidth - 14, 68);
  
  doc.setFont('helvetica', 'bold');
  doc.text(isInstitution ? 'INSTITUTION DETAILS' : 'MEMBER DETAILS', 14, 75);
  doc.setFont('helvetica', 'normal');
  doc.text(`Name: ${subjectName}`, 14, 82);
  doc.text(`${isInstitution ? 'Institution' : 'Member'} No: ${subjectReference}`, 14, 87);
  doc.text(`Phone: ${isInstitution ? (data.institution?.institutionPhone || data.institution?.primaryContactPhone || 'N/A') : (data.member?.user.phone || 'N/A')}`, 14, 92);
  doc.text(`Email: ${isInstitution ? (data.institution?.institutionEmail || 'N/A') : (data.member?.user.email || 'N/A')}`, 14, 97);

  // Account Balances
  doc.setFont('helvetica', 'bold');
  doc.text('ACCOUNT SUMMARY', 100, 75);
  doc.setFont('helvetica', 'normal');
  let balanceY = 82;
  data.accountBalances.forEach(acc => {
    doc.text(`${acc.accountType.name}: ${new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(acc.currentBalance)}`, 100, balanceY);
    balanceY += 5;
  });

  // Transactions Consolidation
  type UnifiedTransaction = {
    date: Date;
    ref: string;
    type: string;
    account: string;
    description: string;
    debit: number;
    credit: number;
    status: string;
  };

  const unified: UnifiedTransaction[] = [
    ...data.transactions.map(t => ({
      date: t.transactionDate,
      ref: t.transactionRef,
      type: t.type,
      account: t.account?.accountType?.name || 'N/A',
      description: t.description || t.type,
      debit: ['WITHDRAWAL', 'TRANSFER_OUT', 'FEE'].includes(t.type) ? t.amount : 0,
      credit: ['DEPOSIT', 'TRANSFER_IN', 'INTEREST'].includes(t.type) ? t.amount : 0,
      status: t.status
    })),
    ...data.deposits.map(d => ({
      date: d.depositDate,
      ref: d.mobileMoneyRef || 'CASH',
      type: 'DEPOSIT',
      account: d.account?.accountType?.name || 'N/A',
      description: `Deposit via ${d.channel} • By ${d.depositedBy || 'Unknown'}`,
      debit: 0,
      credit: d.amount,
      status: 'COMPLETED'
    })),
    ...data.withdrawals.map(w => ({
      date: w.withdrawalDate,
      ref: w.mobileMoneyRef || 'CASH',
      type: 'WITHDRAWAL',
      account: w.account?.accountType?.name || 'N/A',
      description: `Withdrawal via ${w.channel} • By ${w.withdrawnBy || 'Unknown'}`,
      debit: w.amount,
      credit: 0,
      status: 'COMPLETED'
    })),
    ...data.loanRepayments.map(lr => ({
      date: lr.repaymentDate,
      ref: lr.mobileMoneyRef || 'CASH',
      type: 'LOAN_REPAYMENT',
      account: lr.loan.loanApplication.loanProduct.name,
      description: `Loan Repayment via ${lr.channel}`,
      debit: 0,
      credit: lr.amount,
      status: 'COMPLETED'
    }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Transactions Table
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('TRANSACTION HISTORY', 14, 115);

  const tableData = unified.map(txn => [
    new Date(txn.date).toLocaleDateString(),
    txn.ref,
    txn.description,
    txn.account,
    txn.debit > 0 ? new Intl.NumberFormat('en-UG').format(txn.debit) : '-',
    txn.credit > 0 ? new Intl.NumberFormat('en-UG').format(txn.credit) : '-',
    txn.status
  ]);

  autoTable(doc, {
    startY: 120,
    head: [['Date', 'Ref', 'Description', 'Account', 'Debit', 'Credit', 'Status']],
    body: tableData,
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [30, 58, 138], halign: 'center' },
    columnStyles: {
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'center' }
    },
    alternateRowStyles: { fillColor: [249, 250, 251] },
  });

  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, doc.internal.pageSize.height - 10, { align: 'center' });
    doc.text('Bukonzo Teachers SACCO - Building Better Lives', 14, doc.internal.pageSize.height - 10);
  }

  return Buffer.from(doc.output('arraybuffer'));
}
