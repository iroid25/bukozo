"use client";

import ThermalReceipt, { type ReceiptLineItem } from "@/components/ThermalReceipt";

const fmt = (n: number) =>
  `UGX ${Number(n ?? 0).toLocaleString("en-UG", { maximumFractionDigits: 0 })}`;

const fmtDate = (d: string) =>
  d
    ? new Date(d).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "—";

const CHANNEL_LABELS: Record<string, string> = {
  CASH: "Cash",
  MOBILE_MONEY: "Mobile Money",
  BANK_TRANSFER: "Bank Transfer",
  CHEQUE: "Cheque",
};

interface DepositPrintViewProps {
  deposit: any;
  size?: "58mm" | "80mm";
}

export default function DepositPrintView({ deposit, size = "80mm" }: DepositPrintViewProps) {

  const ownerName =
    deposit.member?.user?.name ||
    deposit.institution?.institutionName ||
    deposit.institution?.user?.name ||
    deposit.institutionName ||
    deposit.depositorName ||
    "Unknown";
  const ownerNumber =
    deposit.member?.memberNumber || deposit.institution?.institutionNumber || "N/A";
  const ownerPhone =
    deposit.member?.user?.phone || deposit.institution?.user?.phone || null;
  const ownerEmail =
    deposit.member?.user?.email || deposit.institution?.user?.email || null;

  const txRef = deposit.transaction?.transactionRef || deposit.id;
  const txDate = fmtDate(deposit.depositDate || deposit.createdAt);
  const channel = CHANNEL_LABELS[deposit.channel] || deposit.channel || "—";
  const status = deposit.transaction?.status || "—";
  const accountNo = deposit.account?.accountNumber || "—";
  const accountType = deposit.account?.accountType?.name || "—";
  const branch = deposit.account?.branch?.name || "—";
  const handlerName = deposit.handler?.name || "—";
  const handlerRole = deposit.handler?.role || "—";

  const items: ReceiptLineItem[] = [
    { label: "MEMBER / INST", value: ownerName, bold: true },
    { label: "MEMBER NO.", value: `#${ownerNumber}` },
    ...(ownerPhone ? [{ label: "PHONE", value: ownerPhone }] : []),
    ...(ownerEmail ? [{ label: "EMAIL", value: ownerEmail }] : []),
    { label: "ACCOUNT NO.", value: accountNo, bold: true },
    { label: "ACCOUNT TYPE", value: accountType },
    { label: "BRANCH", value: branch },
    { label: "CHANNEL", value: channel },
    { label: "STATUS", value: status },
    ...(deposit.depositorName
      ? [{ label: "DEPOSITOR", value: deposit.depositorName }]
      : []),
    ...(deposit.mobileMoneyRef
      ? [{ label: "MOMO REF", value: deposit.mobileMoneyRef }]
      : []),
    { label: "PROCESSED BY", value: `${handlerName} (${handlerRole})` },
    ...(deposit.transaction?.description
      ? [{ label: "DESCRIPTION", value: deposit.transaction.description }]
      : []),
  ];

  const footerLines = [
    `This receipt confirms your deposit of ${fmt(deposit.amount)}`,
    `to account ${accountNo}.`,
    "Please keep this receipt for your records.",
  ];

  return (
    <ThermalReceipt
      size={size}
      orderNumber={txRef}
      date={txDate}
      items={items}
      total={fmt(deposit.amount)}
      totalLabel="AMOUNT DEPOSITED"
      footerLines={footerLines}
    />
  );
}
