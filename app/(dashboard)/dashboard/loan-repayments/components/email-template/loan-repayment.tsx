// components/email-templates/loan-repayment.tsx
import React from "react";

interface LoanRepaymentEmailProps {
  userName: string;
  repaymentAmount: number;
  transactionRef: string;
  accountBalance: number;
  transactionDate: Date;
  primaryLoan: {
    id: string;
    outstandingBalance: number;
    totalAmountPaid: number;
    dueDate: Date;
    status: string;
  };
  loanSummary: {
    totalLoans: number;
    totalOutstandingBalance: number;
    totalAmountPaid: number;
  };
}

export function LoanRepaymentNotificationEmail({
  userName,
  repaymentAmount,
  transactionRef,
  accountBalance,
  transactionDate,
  primaryLoan,
  loanSummary,
}: LoanRepaymentEmailProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-UG", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  return (
    <div
      style={{
        fontFamily: "Arial, sans-serif",
        maxWidth: "600px",
        margin: "0 auto",
        padding: "20px",
        backgroundColor: "#ffffff",
      }}
    >
      {/* Header */}
      <div
        style={{
          backgroundColor: "#1e40af",
          padding: "30px 20px",
          textAlign: "center",
          borderRadius: "8px 8px 0 0",
        }}
      >
        <h1
          style={{
            color: "#ffffff",
            margin: "0",
            fontSize: "24px",
            fontWeight: "bold",
          }}
        >
          Loan Repayment Confirmation
        </h1>
        <p
          style={{
            color: "#e5e7eb",
            margin: "8px 0 0 0",
            fontSize: "14px",
          }}
        >
          bukonzoTeachers SACCO
        </p>
      </div>

      {/* Main Content */}
      <div
        style={{
          padding: "30px 20px",
          backgroundColor: "#f9fafb",
        }}
      >
        <p
          style={{
            fontSize: "16px",
            marginBottom: "20px",
            color: "#374151",
          }}
        >
          Dear {userName},
        </p>

        <p
          style={{
            fontSize: "16px",
            marginBottom: "25px",
            color: "#374151",
            lineHeight: "1.5",
          }}
        >
          We confirm that your loan repayment has been successfully processed.
          Here are the details of your transaction and updated account
          information:
        </p>

        {/* Transaction Details */}
        <div
          style={{
            backgroundColor: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            padding: "20px",
            marginBottom: "25px",
          }}
        >
          <h3
            style={{
              fontSize: "18px",
              fontWeight: "bold",
              color: "#1f2937",
              marginBottom: "15px",
              borderBottom: "2px solid #3b82f6",
              paddingBottom: "5px",
            }}
          >
            Transaction Details
          </h3>

          <div style={{ marginBottom: "12px" }}>
            <span style={{ fontWeight: "bold", color: "#374151" }}>
              Amount Paid:
            </span>
            <span
              style={{
                float: "right",
                fontWeight: "bold",
                color: "#16a34a",
                fontSize: "16px",
              }}
            >
              {formatCurrency(repaymentAmount)}
            </span>
          </div>

          <div style={{ marginBottom: "12px" }}>
            <span style={{ fontWeight: "bold", color: "#374151" }}>
              Transaction Ref:
            </span>
            <span style={{ float: "right", color: "#6b7280" }}>
              {transactionRef}
            </span>
          </div>

          <div style={{ marginBottom: "12px" }}>
            <span style={{ fontWeight: "bold", color: "#374151" }}>
              Date & Time:
            </span>
            <span style={{ float: "right", color: "#6b7280" }}>
              {formatDate(transactionDate)}
            </span>
          </div>

          <div
            style={{
              borderTop: "1px solid #e5e7eb",
              paddingTop: "12px",
              marginTop: "15px",
            }}
          >
            <span style={{ fontWeight: "bold", color: "#374151" }}>
              Account Balance:
            </span>
            <span
              style={{
                float: "right",
                fontWeight: "bold",
                color: "#1e40af",
                fontSize: "16px",
              }}
            >
              {formatCurrency(accountBalance)}
            </span>
          </div>
        </div>

        {/* Primary Loan Details */}
        <div
          style={{
            backgroundColor: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            padding: "20px",
            marginBottom: "25px",
          }}
        >
          <h3
            style={{
              fontSize: "18px",
              fontWeight: "bold",
              color: "#1f2937",
              marginBottom: "15px",
              borderBottom: "2px solid #3b82f6",
              paddingBottom: "5px",
            }}
          >
            Primary Loan Status
          </h3>

          <div style={{ marginBottom: "12px" }}>
            <span style={{ fontWeight: "bold", color: "#374151" }}>
              Loan ID:
            </span>
            <span style={{ float: "right", color: "#6b7280" }}>
              {primaryLoan.id.substring(0, 8).toUpperCase()}
            </span>
          </div>

          <div style={{ marginBottom: "12px" }}>
            <span style={{ fontWeight: "bold", color: "#374151" }}>
              Outstanding Balance:
            </span>
            <span
              style={{
                float: "right",
                fontWeight: "bold",
                color:
                  primaryLoan.outstandingBalance > 0 ? "#dc2626" : "#16a34a",
              }}
            >
              {formatCurrency(primaryLoan.outstandingBalance)}
            </span>
          </div>

          <div style={{ marginBottom: "12px" }}>
            <span style={{ fontWeight: "bold", color: "#374151" }}>
              Total Paid:
            </span>
            <span style={{ float: "right", color: "#16a34a" }}>
              {formatCurrency(primaryLoan.totalAmountPaid)}
            </span>
          </div>

          <div style={{ marginBottom: "12px" }}>
            <span style={{ fontWeight: "bold", color: "#374151" }}>
              Due Date:
            </span>
            <span style={{ float: "right", color: "#6b7280" }}>
              {primaryLoan.dueDate.toLocaleDateString()}
            </span>
          </div>

          <div
            style={{
              borderTop: "1px solid #e5e7eb",
              paddingTop: "12px",
              marginTop: "15px",
            }}
          >
            <span style={{ fontWeight: "bold", color: "#374151" }}>
              Status:
            </span>
            <span
              style={{
                float: "right",
                padding: "4px 8px",
                borderRadius: "4px",
                fontSize: "12px",
                fontWeight: "bold",
                backgroundColor:
                  primaryLoan.status === "REPAID" ? "#dcfce7" : "#fef3c7",
                color: primaryLoan.status === "REPAID" ? "#16a34a" : "#d97706",
              }}
            >
              {primaryLoan.status}
            </span>
          </div>
        </div>

        {/* Loan Summary */}
        {loanSummary.totalLoans > 1 && (
          <div
            style={{
              backgroundColor: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              padding: "20px",
              marginBottom: "25px",
            }}
          >
            <h3
              style={{
                fontSize: "18px",
                fontWeight: "bold",
                color: "#1f2937",
                marginBottom: "15px",
                borderBottom: "2px solid #3b82f6",
                paddingBottom: "5px",
              }}
            >
              All Loans Summary
            </h3>

            <div style={{ marginBottom: "12px" }}>
              <span style={{ fontWeight: "bold", color: "#374151" }}>
                Total Active Loans:
              </span>
              <span style={{ float: "right", color: "#6b7280" }}>
                {loanSummary.totalLoans}
              </span>
            </div>

            <div style={{ marginBottom: "12px" }}>
              <span style={{ fontWeight: "bold", color: "#374151" }}>
                Total Outstanding:
              </span>
              <span
                style={{ float: "right", fontWeight: "bold", color: "#dc2626" }}
              >
                {formatCurrency(loanSummary.totalOutstandingBalance)}
              </span>
            </div>

            <div style={{ marginBottom: "0" }}>
              <span style={{ fontWeight: "bold", color: "#374151" }}>
                Total Paid:
              </span>
              <span style={{ float: "right", color: "#16a34a" }}>
                {formatCurrency(loanSummary.totalAmountPaid)}
              </span>
            </div>
          </div>
        )}

        {/* Status Message */}
        {primaryLoan.outstandingBalance === 0 ? (
          <div
            style={{
              backgroundColor: "#dcfce7",
              border: "1px solid #16a34a",
              borderRadius: "8px",
              padding: "15px",
              marginBottom: "25px",
            }}
          >
            <p
              style={{
                margin: "0",
                color: "#16a34a",
                fontWeight: "bold",
                textAlign: "center",
              }}
            >
              🎉 Congratulations! Your loan has been fully repaid!
            </p>
          </div>
        ) : (
          <div
            style={{
              backgroundColor: "#fef3c7",
              border: "1px solid #d97706",
              borderRadius: "8px",
              padding: "15px",
              marginBottom: "25px",
            }}
          >
            <p
              style={{
                margin: "0",
                color: "#92400e",
                textAlign: "center",
              }}
            >
              Please continue making regular payments to clear your remaining
              balance.
            </p>
          </div>
        )}

        <p
          style={{
            fontSize: "14px",
            color: "#6b7280",
            lineHeight: "1.5",
            marginBottom: "0",
          }}
        >
          Thank you for your continued trust in bukonzoTeachers SACCO. If you
          have any questions about this transaction or your account, please
          don't hesitate to contact us.
        </p>
      </div>

      {/* Footer */}
      <div
        style={{
          backgroundColor: "#f3f4f6",
          padding: "20px",
          textAlign: "center",
          borderRadius: "0 0 8px 8px",
          borderTop: "1px solid #e5e7eb",
        }}
      >
        <p
          style={{
            margin: "0 0 8px 0",
            fontSize: "14px",
            fontWeight: "bold",
            color: "#374151",
          }}
        >
          Best regards,
          <br />
          bukonzoTeachers SACCO Team
        </p>

        <p
          style={{
            margin: "0",
            fontSize: "12px",
            color: "#6b7280",
          }}
        >
          This is an automated email. Please do not reply directly to this
          message.
        </p>
      </div>
    </div>
  );
}
