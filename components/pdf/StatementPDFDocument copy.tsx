// components/pdf/StatementPDFDocument.tsx
import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Font,
} from "@react-pdf/renderer";
import { StatementData } from "@/types/statements";

interface StatementPDFDocumentProps {
  data: StatementData;
  periodStart: Date; // ✅ Add these as separate props
  periodEnd: Date; // ✅ Add these as separate props
  organizationName?: string;
  organizationAddress?: string;
  organizationPhone?: string;
  organizationEmail?: string;
  logoUrl?: string;
}

// Define styles
const styles = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: "#ffffff",
    padding: 30,
    fontSize: 10,
    fontFamily: "Helvetica",
  },
  header: {
    marginBottom: 20,
    borderBottom: 2,
    borderBottomColor: "#003366",
    paddingBottom: 10,
  },
  logo: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#003366",
    textAlign: "center",
    marginBottom: 5,
  },
  organizationDetails: {
    fontSize: 8,
    color: "#666666",
    textAlign: "center",
    lineHeight: 1.3,
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
    color: "#003366",
    margin: "15 0",
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#003366",
    borderBottom: 1,
    borderBottomColor: "#cccccc",
    paddingBottom: 3,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  infoGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  infoColumn: {
    flex: 1,
    paddingRight: 10,
  },
  infoItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  label: {
    fontWeight: "bold",
    color: "#666666",
    fontSize: 9,
  },
  value: {
    color: "#333333",
    fontSize: 9,
  },
  accountSummary: {
    backgroundColor: "#f8f9fa",
    padding: 10,
    borderRadius: 3,
    marginBottom: 10,
  },
  summaryGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
    textAlign: "center",
    marginVertical: 15,
  },
  summaryItem: {
    backgroundColor: "#ffffff",
    padding: 10,
    borderRadius: 3,
    border: 1,
    borderColor: "#dddddd",
    flex: 1,
    marginHorizontal: 5,
    alignItems: "center",
  },
  summaryAmount: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#003366",
  },
  summaryLabel: {
    fontSize: 8,
    color: "#666666",
    marginTop: 2,
  },
  table: {
    width: "100%",
    border: "1px solid #dddddd",
    marginTop: 10,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#dddddd",
    borderBottomStyle: "solid",
  },
  tableHeader: {
    backgroundColor: "#003366",
    flexDirection: "row",
  },
  tableHeaderCell: {
    border: "1px solid #dddddd",
    padding: 5,
    fontSize: 8,
    fontWeight: "bold",
    color: "#ffffff",
    textAlign: "center",
    flex: 1,
  },
  tableCell: {
    border: "1px solid #dddddd",
    padding: 4,
    fontSize: 8,
    textAlign: "left",
    flex: 1,
  },
  positiveAmount: {
    color: "#28a745",
    fontWeight: "bold",
  },
  negativeAmount: {
    color: "#dc3545",
    fontWeight: "bold",
  },
  footer: {
    marginTop: 20,
    paddingTop: 10,
    borderTop: 1,
    borderTopColor: "#cccccc",
    fontSize: 8,
    color: "#666666",
    textAlign: "center",
    lineHeight: 1.3,
  },
  pageNumber: {
    position: "absolute",
    fontSize: 8,
    bottom: 30,
    left: 0,
    right: 0,
    textAlign: "center",
    color: "#666666",
  },
});

const StatementPDFDocument: React.FC<StatementPDFDocumentProps> = ({
  data,
  periodStart, // ✅ Destructure the new props
  periodEnd, // ✅ Destructure the new props
  organizationName = "SACCO Bank",
  organizationAddress,
  organizationPhone,
  organizationEmail,
  logoUrl,
}) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-GB", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(date));
  };

  const getAccountTypeDisplayName = (name: string) => {
    const displayNames: { [key: string]: string } = {
      VOLUNTARY_SAVINGS: "Voluntary Savings",
      FIXED_DEPOSIT: "Fixed Deposit",
      EMERGENCY_SAVINGS: "Emergency Savings",
    };
    return displayNames[name] || name;
  };

  const totalDeposits = data.deposits.reduce(
    (sum, deposit) => sum + deposit.amount,
    0
  );
  const totalWithdrawals = data.withdrawals.reduce(
    (sum, withdrawal) => sum + withdrawal.amount,
    0
  );
  const totalBalance = data.accountBalances.reduce(
    (sum, account) => sum + account.currentBalance,
    0
  );
  const subjectName =
    data.member?.user.name || data.institution?.institutionName || "Account Holder";
  const subjectNumber =
    data.member?.memberNumber || data.institution?.institutionNumber || "N/A";
  const subjectEmail =
    data.member?.user.email || data.institution?.institutionEmail || "N/A";
  const subjectPhone =
    data.member?.user.phone ||
    data.institution?.institutionPhone ||
    data.institution?.primaryContactPhone ||
    "N/A";
  const subjectLabel = data.subjectType === "INSTITUTION" ? "Institution" : "Member";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          {logoUrl && (
            <Image
              src={logoUrl}
              style={{ width: 50, height: 50, marginBottom: 10 }}
            />
          )}
          <Text style={styles.logo}>{organizationName}</Text>
          <View style={styles.organizationDetails}>
            {organizationAddress && <Text>{organizationAddress}</Text>}
            <Text>
              {organizationPhone && `Tel: ${organizationPhone}`}
              {organizationPhone && organizationEmail && " | "}
              {organizationEmail && `Email: ${organizationEmail}`}
            </Text>
          </View>
        </View>

        <Text style={styles.title}>BANK STATEMENT</Text>

        {/* Subject Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{subjectLabel} Information</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoColumn}>
              <View style={styles.infoItem}>
                <Text style={styles.label}>Name:</Text>
                <Text style={styles.value}>{subjectName}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.label}>{subjectLabel} Number:</Text>
                <Text style={styles.value}>#{subjectNumber}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.label}>Email:</Text>
                <Text style={styles.value}>{subjectEmail}</Text>
              </View>
            </View>
            <View style={styles.infoColumn}>
              <View style={styles.infoItem}>
                <Text style={styles.label}>Phone:</Text>
                <Text style={styles.value}>{subjectPhone}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.label}>Statement Period:</Text>
                <Text style={styles.value}>
                  {formatDate(periodStart)} - {formatDate(periodEnd)}{" "}
                  {/* ✅ Use the props */}
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.label}>Generated On:</Text>
                <Text style={styles.value}>{formatDate(new Date())}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Account Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Summary</Text>
          {data.accountBalances.map((account, index) => (
            <View key={account.id} style={styles.accountSummary}>
              <View style={styles.infoGrid}>
                <View style={styles.infoColumn}>
                  <View style={styles.infoItem}>
                    <Text style={styles.label}>Account Number:</Text>
                    <Text style={styles.value}>{account.accountNumber}</Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={styles.label}>Account Type:</Text>
                    <Text style={styles.value}>
                      {getAccountTypeDisplayName(account.accountType.name)}
                    </Text>
                  </View>
                </View>
                <View style={styles.infoColumn}>
                  <View style={styles.infoItem}>
                    <Text style={styles.label}>Branch:</Text>
                    <Text style={styles.value}>{account.branch.name}</Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={styles.label}>Current Balance:</Text>
                    <Text style={[styles.value, { fontWeight: "bold" }]}>
                      {formatCurrency(account.currentBalance)}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Transaction Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Transaction Summary</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryAmount, styles.positiveAmount]}>
                {formatCurrency(totalDeposits)}
              </Text>
              <Text style={styles.summaryLabel}>
                Total Deposits ({data.deposits.length} transactions)
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryAmount, styles.negativeAmount]}>
                {formatCurrency(totalWithdrawals)}
              </Text>
              <Text style={styles.summaryLabel}>
                Total Withdrawals ({data.withdrawals.length} transactions)
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryAmount}>
                {formatCurrency(totalBalance)}
              </Text>
              <Text style={styles.summaryLabel}>Total Balance</Text>
            </View>
          </View>
        </View>

        {/* Transaction History */}
        {data.transactions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Transaction History</Text>

            {/* Table Header */}
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={styles.tableHeaderCell}>Date</Text>
              <Text style={styles.tableHeaderCell}>Reference</Text>
              <Text style={styles.tableHeaderCell}>Description</Text>
              <Text style={styles.tableHeaderCell}>Type</Text>
              <Text style={styles.tableHeaderCell}>Account</Text>
              <Text style={styles.tableHeaderCell}>Amount</Text>
            </View>

            {/* Table Rows */}
            {data.transactions.slice(0, 20).map((transaction, index) => (
              <View key={transaction.id} style={styles.tableRow}>
                <Text style={styles.tableCell}>
                  {formatDate(transaction.transactionDate)}
                </Text>
                <Text style={styles.tableCell}>
                  {transaction.transactionRef}
                </Text>
                <Text style={styles.tableCell}>
                  {transaction.description || "-"}
                </Text>
                <Text style={styles.tableCell}>
                  {transaction.type.replace("_", " ")}
                </Text>
                <Text style={styles.tableCell}>
                  {transaction.account.accountNumber}
                </Text>
                <Text
                  style={[
                    styles.tableCell,
                    transaction.type === "DEPOSIT" ||
                    transaction.type === "LOAN_DISBURSEMENT"
                      ? styles.positiveAmount
                      : styles.negativeAmount,
                  ]}
                >
                  {transaction.type === "DEPOSIT" ||
                  transaction.type === "LOAN_DISBURSEMENT"
                    ? "+"
                    : "-"}
                  {formatCurrency(transaction.amount)}
                </Text>
              </View>
            ))}

            {data.transactions.length > 20 && (
              <Text
                style={{
                  fontSize: 8,
                  color: "#666666",
                  marginTop: 5,
                  textAlign: "center",
                }}
              >
                Showing first 20 transactions. Total: {data.transactions.length}{" "}
                transactions.
              </Text>
            )}
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text>
            This statement was generated electronically on{" "}
            {formatDate(new Date())}.
          </Text>
          <Text>
            For any queries, please contact {organizationName} customer service.
          </Text>
          {(organizationPhone || organizationEmail) && (
            <Text>
              {organizationPhone && `Phone: ${organizationPhone}`}
              {organizationPhone && organizationEmail && " | "}
              {organizationEmail && `Email: ${organizationEmail}`}
            </Text>
          )}
        </View>

        {/* Page Number */}
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) =>
            `Page ${pageNumber} of ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
};

export default StatementPDFDocument;
