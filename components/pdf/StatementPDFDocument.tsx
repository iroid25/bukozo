// // components/pdf/SimpleStatementPDF.tsx
// import React from "react";
// import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
// import { StatementData } from "@/types/statements";

// interface SimpleStatementPDFProps {
//   data: StatementData;
//   periodStart: Date; // ✅ Add this prop
//   periodEnd: Date; // ✅ Add this prop
//   organizationName?: string;
//   organizationAddress?: string;
//   organizationPhone?: string;
//   organizationEmail?: string;
// }

// // Simplified styles that work with React-PDF
// const styles = StyleSheet.create({
//   page: {
//     flexDirection: "column",
//     backgroundColor: "#ffffff",
//     padding: 30,
//     fontSize: 10,
//     fontFamily: "Helvetica",
//   },
//   header: {
//     marginBottom: 20,
//     paddingBottom: 10,
//     borderBottomWidth: 2,
//     borderBottomColor: "#003366",
//   },
//   title: {
//     fontSize: 20,
//     fontWeight: "bold",
//     textAlign: "center",
//     color: "#003366",
//     marginBottom: 10,
//   },
//   organizationInfo: {
//     fontSize: 8,
//     color: "#666666",
//     textAlign: "center",
//     marginBottom: 5,
//   },
//   sectionTitle: {
//     fontSize: 12,
//     fontWeight: "bold",
//     color: "#003366",
//     marginTop: 15,
//     marginBottom: 8,
//     borderBottomWidth: 1,
//     borderBottomColor: "#cccccc",
//     paddingBottom: 3,
//   },
//   row: {
//     flexDirection: "row",
//     justifyContent: "space-between",
//     marginBottom: 5,
//     paddingVertical: 2,
//   },
//   label: {
//     fontWeight: "bold",
//     color: "#666666",
//     fontSize: 9,
//     width: "40%",
//   },
//   value: {
//     color: "#333333",
//     fontSize: 9,
//     width: "60%",
//   },
//   accountBox: {
//     backgroundColor: "#f8f9fa",
//     padding: 10,
//     marginBottom: 10,
//     borderRadius: 3,
//   },
//   summaryContainer: {
//     flexDirection: "row",
//     justifyContent: "space-around",
//     marginVertical: 15,
//     paddingVertical: 10,
//     backgroundColor: "#f5f5f5",
//   },
//   summaryItem: {
//     alignItems: "center",
//     flex: 1,
//   },
//   summaryAmount: {
//     fontSize: 12,
//     fontWeight: "bold",
//     color: "#003366",
//   },
//   summaryLabel: {
//     fontSize: 8,
//     color: "#666666",
//     marginTop: 3,
//     textAlign: "center",
//   },
//   transactionItem: {
//     paddingVertical: 5,
//     paddingHorizontal: 10,
//     marginBottom: 3,
//     backgroundColor: "#fafafa",
//     borderRadius: 2,
//   },
//   transactionHeader: {
//     flexDirection: "row",
//     justifyContent: "space-between",
//     marginBottom: 2,
//   },
//   transactionRef: {
//     fontSize: 9,
//     fontWeight: "bold",
//     color: "#333333",
//   },
//   transactionAmount: {
//     fontSize: 9,
//     fontWeight: "bold",
//   },
//   positiveAmount: {
//     color: "#28a745",
//   },
//   negativeAmount: {
//     color: "#dc3545",
//   },
//   transactionDetails: {
//     fontSize: 8,
//     color: "#666666",
//     marginTop: 2,
//   },
//   footer: {
//     marginTop: 30,
//     paddingTop: 15,
//     borderTopWidth: 1,
//     borderTopColor: "#cccccc",
//     fontSize: 8,
//     color: "#666666",
//     textAlign: "center",
//   },
//   pageNumber: {
//     position: "absolute",
//     fontSize: 8,
//     bottom: 30,
//     left: 0,
//     right: 0,
//     textAlign: "center",
//     color: "#666666",
//   },
// });

// const SimpleStatementPDF: React.FC<SimpleStatementPDFProps> = ({
//   data,
//   periodStart, // ✅ Destructure the new props
//   periodEnd, // ✅ Destructure the new props
//   organizationName = "SACCO Bank",
//   organizationAddress,
//   organizationPhone,
//   organizationEmail,
// }) => {
//   const formatCurrency = (amount: number) => {
//     return new Intl.NumberFormat("en-UG", {
//       style: "currency",
//       currency: "UGX",
//       minimumFractionDigits: 0,
//     }).format(amount);
//   };

//   const formatDate = (date: Date) => {
//     return new Intl.DateTimeFormat("en-GB", {
//       year: "numeric",
//       month: "short",
//       day: "numeric",
//     }).format(new Date(date));
//   };

//   const getAccountTypeDisplayName = (name: string) => {
//     const displayNames: { [key: string]: string } = {
//       VOLUNTARY_SAVINGS: "Voluntary Savings",
//       FIXED_DEPOSIT: "Fixed Deposit",
//       EMERGENCY_SAVINGS: "Emergency Savings",
//     };
//     return displayNames[name] || name;
//   };

//   const totalDeposits = data.deposits.reduce(
//     (sum, deposit) => sum + deposit.amount,
//     0
//   );
//   const totalWithdrawals = data.withdrawals.reduce(
//     (sum, withdrawal) => sum + withdrawal.amount,
//     0
//   );
//   const totalBalance = data.accountBalances.reduce(
//     (sum, account) => sum + account.currentBalance,
//     0
//   );

//   return (
//     <Document>
//       <Page size="A4" style={styles.page}>
//         {/* Header */}
//         <View style={styles.header}>
//           <Text style={styles.title}>{organizationName}</Text>
//           {organizationAddress && (
//             <Text style={styles.organizationInfo}>{organizationAddress}</Text>
//           )}
//           <Text style={styles.organizationInfo}>
//             {organizationPhone && `Tel: ${organizationPhone}`}
//             {organizationPhone && organizationEmail && " | "}
//             {organizationEmail && `Email: ${organizationEmail}`}
//           </Text>
//         </View>

//         <Text style={[styles.title, { fontSize: 16, marginTop: 0 }]}>
//           BANK STATEMENT
//         </Text>

//         {/* Member Information */}
//         <Text style={styles.sectionTitle}>Member Information</Text>
//         <View style={styles.row}>
//           <Text style={styles.label}>Name:</Text>
//           <Text style={styles.value}>{data.member.user.name}</Text>
//         </View>
//         <View style={styles.row}>
//           <Text style={styles.label}>Member Number:</Text>
//           <Text style={styles.value}>#{data.member.memberNumber}</Text>
//         </View>
//         <View style={styles.row}>
//           <Text style={styles.label}>Email:</Text>
//           <Text style={styles.value}>{data.member.user.email}</Text>
//         </View>
//         <View style={styles.row}>
//           <Text style={styles.label}>Phone:</Text>
//           <Text style={styles.value}>{data.member.user.phone || "N/A"}</Text>
//         </View>
//         <View style={styles.row}>
//           <Text style={styles.label}>Statement Period:</Text>
//           <Text style={styles.value}>
//             {formatDate(periodStart)} to {formatDate(periodEnd)}{" "}
//             {/* ✅ Use the props */}
//           </Text>
//         </View>
//         <View style={styles.row}>
//           <Text style={styles.label}>Generated On:</Text>
//           <Text style={styles.value}>{formatDate(new Date())}</Text>
//         </View>

//         {/* Account Summary */}
//         <Text style={styles.sectionTitle}>Account Summary</Text>
//         {data.accountBalances.map((account, index) => (
//           <View key={account.id} style={styles.accountBox}>
//             <View style={styles.row}>
//               <Text style={styles.label}>Account Number:</Text>
//               <Text style={styles.value}>{account.accountNumber}</Text>
//             </View>
//             <View style={styles.row}>
//               <Text style={styles.label}>Account Type:</Text>
//               <Text style={styles.value}>
//                 {getAccountTypeDisplayName(account.accountType.name)}
//               </Text>
//             </View>
//             <View style={styles.row}>
//               <Text style={styles.label}>Branch:</Text>
//               <Text style={styles.value}>{account.branch.name}</Text>
//             </View>
//             <View style={styles.row}>
//               <Text style={styles.label}>Current Balance:</Text>
//               <Text style={[styles.value, { fontWeight: "bold" }]}>
//                 {formatCurrency(account.currentBalance)}
//               </Text>
//             </View>
//           </View>
//         ))}

//         {/* Transaction Summary */}
//         <Text style={styles.sectionTitle}>Transaction Summary</Text>
//         <View style={styles.summaryContainer}>
//           <View style={styles.summaryItem}>
//             <Text style={[styles.summaryAmount, styles.positiveAmount]}>
//               {formatCurrency(totalDeposits)}
//             </Text>
//             <Text style={styles.summaryLabel}>
//               Total Deposits{"\n"}({data.deposits.length} transactions)
//             </Text>
//           </View>
//           <View style={styles.summaryItem}>
//             <Text style={[styles.summaryAmount, styles.negativeAmount]}>
//               {formatCurrency(totalWithdrawals)}
//             </Text>
//             <Text style={styles.summaryLabel}>
//               Total Withdrawals{"\n"}({data.withdrawals.length} transactions)
//             </Text>
//           </View>
//           <View style={styles.summaryItem}>
//             <Text style={styles.summaryAmount}>
//               {formatCurrency(totalBalance)}
//             </Text>
//             <Text style={styles.summaryLabel}>Total Balance</Text>
//           </View>
//         </View>

//         {/* Transaction History */}
//         {data.transactions.length > 0 && (
//           <View>
//             <Text style={styles.sectionTitle}>Transaction History</Text>
//             {data.transactions.slice(0, 15).map((transaction, index) => (
//               <View key={transaction.id} style={styles.transactionItem}>
//                 <View style={styles.transactionHeader}>
//                   <Text style={styles.transactionRef}>
//                     {transaction.transactionRef}
//                   </Text>
//                   <Text
//                     style={[
//                       styles.transactionAmount,
//                       transaction.type === "DEPOSIT" ||
//                       transaction.type === "LOAN_DISBURSEMENT"
//                         ? styles.positiveAmount
//                         : styles.negativeAmount,
//                     ]}
//                   >
//                     {transaction.type === "DEPOSIT" ||
//                     transaction.type === "LOAN_DISBURSEMENT"
//                       ? "+"
//                       : "-"}
//                     {formatCurrency(transaction.amount)}
//                   </Text>
//                 </View>
//                 <Text style={styles.transactionDetails}>
//                   {formatDate(transaction.transactionDate)} |{" "}
//                   {transaction.type.replace("_", " ")} |{" "}
//                   {transaction.account.accountNumber}
//                 </Text>
//                 {transaction.description && (
//                   <Text style={styles.transactionDetails}>
//                     {transaction.description}
//                   </Text>
//                 )}
//               </View>
//             ))}

//             {data.transactions.length > 15 && (
//               <Text
//                 style={{
//                   fontSize: 8,
//                   color: "#666666",
//                   marginTop: 10,
//                   textAlign: "center",
//                 }}
//               >
//                 Showing first 15 transactions. Total: {data.transactions.length}{" "}
//                 transactions.
//               </Text>
//             )}
//           </View>
//         )}

//         {/* Footer */}
//         <View style={styles.footer}>
//           <Text>
//             This statement was generated electronically on{" "}
//             {formatDate(new Date())}.
//           </Text>
//           <Text>
//             For any queries, please contact {organizationName} customer service.
//           </Text>
//           {(organizationPhone || organizationEmail) && (
//             <Text>
//               {organizationPhone && `Phone: ${organizationPhone}`}
//               {organizationPhone && organizationEmail && " | "}
//               {organizationEmail && `Email: ${organizationEmail}`}
//             </Text>
//           )}
//         </View>

//         {/* Page Number */}
//         <Text
//           style={styles.pageNumber}
//           render={({ pageNumber, totalPages }) =>
//             `Page ${pageNumber} of ${totalPages}`
//           }
//           fixed
//         />
//       </Page>
//     </Document>
//   );
// };

// export default SimpleStatementPDF;
// components/pdf/SimpleStatementPDF.tsx
import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { StatementData } from "@/types/statements";
import { REPORT_HEADER_DETAILS } from "@/lib/report-header";

interface SimpleStatementPDFProps {
  data: StatementData;
  periodStart: Date;
  periodEnd: Date;
  organizationName?: string;
  organizationAddress?: string;
  organizationPhone?: string;
  organizationEmail?: string;
}

// Simplified styles that work with React-PDF
const styles = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: "#ffffff",
    padding: 30,
    fontSize: 10,
    fontFamily: "Helvetica",
  },
  header: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: "#111827",
  },
  institutionName: {
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
    color: "#1e1b4b",
    marginBottom: 4,
  },
  institutionMeta: {
    fontSize: 8,
    color: "#4b5563",
    textAlign: "center",
    marginBottom: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    color: "#003366",
    marginBottom: 6,
  },
  organizationInfo: {
    fontSize: 8,
    color: "#666666",
    textAlign: "center",
    marginBottom: 5,
  },
  statementSubjectBox: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#d1d5db",
  },
  statementSubject: {
    fontSize: 9,
    color: "#374151",
    textAlign: "center",
    marginBottom: 2,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#003366",
    marginTop: 15,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#cccccc",
    paddingBottom: 3,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
    paddingVertical: 2,
  },
  label: {
    fontWeight: "bold",
    color: "#666666",
    fontSize: 9,
    width: "40%",
  },
  value: {
    color: "#333333",
    fontSize: 9,
    width: "60%",
  },
  accountBox: {
    backgroundColor: "#f8f9fa",
    padding: 10,
    marginBottom: 10,
    borderRadius: 3,
  },
  summaryContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginVertical: 15,
    paddingVertical: 10,
    backgroundColor: "#f5f5f5",
  },
  summaryItem: {
    alignItems: "center",
    flex: 1,
  },
  summaryAmount: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#003366",
  },
  summaryLabel: {
    fontSize: 8,
    color: "#666666",
    marginTop: 3,
    textAlign: "center",
  },
  transactionItem: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginBottom: 3,
    backgroundColor: "#fafafa",
    borderRadius: 2,
  },
  transactionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  transactionRef: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#333333",
  },
  transactionAmount: {
    fontSize: 9,
    fontWeight: "bold",
  },
  positiveAmount: {
    color: "#28a745",
  },
  negativeAmount: {
    color: "#dc3545",
  },
  transactionDetails: {
    fontSize: 8,
    color: "#666666",
    marginTop: 2,
  },
  footer: {
    marginTop: 30,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: "#cccccc",
    fontSize: 8,
    color: "#666666",
    textAlign: "center",
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

const SimpleStatementPDF: React.FC<SimpleStatementPDFProps> = ({
  data,
  periodStart,
  periodEnd,
  organizationName = REPORT_HEADER_DETAILS.institutionName,
  organizationAddress,
  organizationPhone = REPORT_HEADER_DETAILS.contacts.join(" / "),
  organizationEmail = REPORT_HEADER_DETAILS.email,
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
      month: "short",
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

  const resolvedAddress =
    organizationAddress || REPORT_HEADER_DETAILS.postalAddress.join(", ");
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
          <Text style={styles.institutionName}>{organizationName}</Text>
          <Text style={styles.institutionMeta}>
            {REPORT_HEADER_DETAILS.registrationNumber}
          </Text>
          <Text style={styles.institutionMeta}>{resolvedAddress}</Text>
          <Text style={styles.organizationInfo}>
            {organizationPhone && `Contacts: ${organizationPhone}`}
          </Text>
          <Text style={styles.organizationInfo}>
            {organizationEmail && `Email: ${organizationEmail}`}
          </Text>
          <View style={styles.statementSubjectBox}>
            <Text style={styles.title}>
              {data.subjectType === "INSTITUTION"
                ? "INSTITUTION ACCOUNT STATEMENT"
                : "MEMBER ACCOUNT STATEMENT"}
            </Text>
            <Text style={styles.statementSubject}>
              Account Holder: {subjectName}
            </Text>
            <Text style={styles.statementSubject}>
              {subjectLabel} No: #{subjectNumber}
            </Text>
          </View>
        </View>

        {/* Subject Information */}
        <Text style={styles.sectionTitle}>{subjectLabel} Information</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Name:</Text>
          <Text style={styles.value}>{subjectName}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>{subjectLabel} Number:</Text>
          <Text style={styles.value}>#{subjectNumber}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Email:</Text>
          <Text style={styles.value}>{subjectEmail}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Phone:</Text>
          <Text style={styles.value}>{subjectPhone}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Statement Period:</Text>
          <Text style={styles.value}>
            {formatDate(periodStart)} to {formatDate(periodEnd)}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Generated On:</Text>
          <Text style={styles.value}>{formatDate(new Date())}</Text>
        </View>

        {/* Account Summary */}
        <Text style={styles.sectionTitle}>Account Summary</Text>
        {data.accountBalances.map((account, index) => (
          <View key={account.id} style={styles.accountBox}>
            <View style={styles.row}>
              <Text style={styles.label}>Account Number:</Text>
              <Text style={styles.value}>{account.accountNumber}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Account Type:</Text>
              <Text style={styles.value}>
                {getAccountTypeDisplayName(account.accountType.name)}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Branch:</Text>
              <Text style={styles.value}>{account.branch.name}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Current Balance:</Text>
              <Text style={[styles.value, { fontWeight: "bold" }]}>
                {formatCurrency(account.currentBalance)}
              </Text>
            </View>
          </View>
        ))}

        {/* Transaction Summary */}
        <Text style={styles.sectionTitle}>Transaction Summary</Text>
        <View style={styles.summaryContainer}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryAmount, styles.positiveAmount]}>
              {formatCurrency(totalDeposits)}
            </Text>
            <Text style={styles.summaryLabel}>
              Total Deposits{"\n"}({data.deposits.length} transactions)
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryAmount, styles.negativeAmount]}>
              {formatCurrency(totalWithdrawals)}
            </Text>
            <Text style={styles.summaryLabel}>
              Total Withdrawals{"\n"}({data.withdrawals.length} transactions)
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryAmount}>
              {formatCurrency(totalBalance)}
            </Text>
            <Text style={styles.summaryLabel}>Total Balance</Text>
          </View>
        </View>

        {/* Transaction History */}
        {data.transactions.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Transaction History</Text>
            {data.transactions.slice(0, 15).map((transaction, index) => (
              <View key={transaction.id} style={styles.transactionItem}>
                <View style={styles.transactionHeader}>
                  <Text style={styles.transactionRef}>
                    {transaction.transactionRef}
                  </Text>
                  <Text
                    style={[
                      styles.transactionAmount,
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
                <Text style={styles.transactionDetails}>
                  {formatDate(transaction.transactionDate)} |{" "}
                  {transaction.type.replace("_", " ")} |{" "}
                  {transaction.account.accountNumber}
                </Text>
                {transaction.description && (
                  <Text style={styles.transactionDetails}>
                    {transaction.description}
                  </Text>
                )}
              </View>
            ))}

            {data.transactions.length > 15 && (
              <Text
                style={{
                  fontSize: 8,
                  color: "#666666",
                  marginTop: 10,
                  textAlign: "center",
                }}
              >
                Showing first 15 transactions. Total: {data.transactions.length}{" "}
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

export default SimpleStatementPDF;
