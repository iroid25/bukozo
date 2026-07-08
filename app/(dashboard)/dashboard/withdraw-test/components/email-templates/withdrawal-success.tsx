// components/email-templates/withdrawal-success.tsx
import * as React from "react";

interface WithdrawalSuccessEmailProps {
  memberName: string;
  withdrawalAmount: number;
  newBalance: number;
  transactionRef: string;
  accountNumber: string;
  channel: string;
  withdrawalDate: string;
  accountTypeName: string;
  branchName: string;
}

export const WithdrawalSuccessEmail: React.FC<WithdrawalSuccessEmailProps> = ({
  memberName,
  withdrawalAmount,
  newBalance,
  transactionRef,
  accountNumber,
  channel,
  withdrawalDate,
  accountTypeName,
  branchName,
}) => {
  const formattedDate = new Date(withdrawalDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Kampala",
  });

  return (
    <div
      style={{
        fontFamily: "Arial, sans-serif",
        lineHeight: "1.6",
        color: "#333",
        maxWidth: "600px",
        margin: "0 auto",
        padding: "20px",
      }}
    >
      {/* Header */}
      <div
        style={{
          backgroundColor: "#10b981",
          padding: "30px 20px",
          textAlign: "center",
          borderRadius: "8px 8px 0 0",
        }}
      >
        <h1
          style={{
            color: "white",
            margin: "0",
            fontSize: "28px",
            fontWeight: "bold",
          }}
        >
          ✅ Withdrawal Successful
        </h1>
      </div>

      {/* Content */}
      <div
        style={{
          backgroundColor: "#f9fafb",
          padding: "30px 20px",
          border: "1px solid #e5e7eb",
          borderTop: "none",
        }}
      >
        <p style={{ fontSize: "16px", marginBottom: "20px" }}>
          Dear <strong>{memberName}</strong>,
        </p>

        <p style={{ fontSize: "16px", marginBottom: "25px" }}>
          Your withdrawal has been successfully processeds. Below are the
          details of your transaction:
        </p>

        {/* Transaction Details Card */}
        <div
          style={{
            backgroundColor: "white",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            padding: "25px",
            marginBottom: "25px",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
          }}
        >
          <h2
            style={{
              color: "#374151",
              fontSize: "18px",
              marginBottom: "20px",
              borderBottom: "2px solid #10b981",
              paddingBottom: "10px",
            }}
          >
            Transaction Details
          </h2>

          <div
            style={{
              display: "grid",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#6b7280", fontWeight: "500" }}>
                Transaction Reference:
              </span>
              <span style={{ fontWeight: "bold", color: "#10b981" }}>
                {transactionRef}
              </span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#6b7280", fontWeight: "500" }}>
                Amount Withdrawn:
              </span>
              <span
                style={{
                  fontWeight: "bold",
                  fontSize: "18px",
                  color: "#dc2626",
                }}
              >
                UGX {withdrawalAmount.toLocaleString()}
              </span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#6b7280", fontWeight: "500" }}>
                Withdrawal Method:
              </span>
              <span style={{ fontWeight: "600" }}>{channel}</span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#6b7280", fontWeight: "500" }}>
                Date & Time:
              </span>
              <span style={{ fontWeight: "600" }}>{formattedDate}</span>
            </div>
          </div>
        </div>

        {/* Account Details Card */}
        <div
          style={{
            backgroundColor: "white",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            padding: "25px",
            marginBottom: "25px",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
          }}
        >
          <h2
            style={{
              color: "#374151",
              fontSize: "18px",
              marginBottom: "20px",
              borderBottom: "2px solid #3b82f6",
              paddingBottom: "10px",
            }}
          >
            Account Information
          </h2>

          <div
            style={{
              display: "grid",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#6b7280", fontWeight: "500" }}>
                Account Number:
              </span>
              <span style={{ fontWeight: "600" }}>{accountNumber}</span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#6b7280", fontWeight: "500" }}>
                Account Type:
              </span>
              <span style={{ fontWeight: "600" }}>{accountTypeName}</span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#6b7280", fontWeight: "500" }}>
                Branch:
              </span>
              <span style={{ fontWeight: "600" }}>{branchName}</span>
            </div>

            <hr
              style={{
                margin: "15px 0",
                border: "none",
                borderTop: "1px solid #e5e7eb",
              }}
            />

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  color: "#6b7280",
                  fontWeight: "500",
                  fontSize: "16px",
                }}
              >
                Current Account Balance:
              </span>
              <span
                style={{
                  fontWeight: "bold",
                  fontSize: "20px",
                  color: "#10b981",
                  backgroundColor: "#f0fdf4",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  border: "1px solid #bbf7d0",
                }}
              >
                UGX {newBalance.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Important Notice */}
        <div
          style={{
            backgroundColor: "#fef3c7",
            border: "1px solid #f59e0b",
            borderRadius: "8px",
            padding: "20px",
            marginBottom: "25px",
          }}
        >
          <h3
            style={{
              color: "#92400e",
              fontSize: "16px",
              marginBottom: "10px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            ⚠️ Important Notice
          </h3>
          <p style={{ color: "#92400e", margin: "0", fontSize: "14px" }}>
            Please keep this transaction reference ({transactionRef}) for your
            records. If you did not authorize this withdrawal, please contact us
            immediately.
          </p>
        </div>

        {/* Security Tips */}
        <div
          style={{
            backgroundColor: "#eff6ff",
            border: "1px solid #3b82f6",
            borderRadius: "8px",
            padding: "20px",
            marginBottom: "25px",
          }}
        >
          <h3
            style={{
              color: "#1e40af",
              fontSize: "16px",
              marginBottom: "15px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            🔒 Security Tips
          </h3>
          <ul
            style={{
              color: "#1e40af",
              margin: "0",
              paddingLeft: "20px",
              fontSize: "14px",
            }}
          >
            <li style={{ marginBottom: "8px" }}>
              Never share your verification codes with unauthorized persons
            </li>
            <li style={{ marginBottom: "8px" }}>
              Always verify your account balance after transactions
            </li>
            <li style={{ marginBottom: "8px" }}>
              Report any suspicious activity immediately
            </li>
            <li>Keep your account information secure</li>
          </ul>
        </div>

        {/* Contact Information */}
        <div
          style={{
            backgroundColor: "white",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            padding: "20px",
            textAlign: "center",
          }}
        >
          <h3
            style={{ color: "#374151", fontSize: "16px", marginBottom: "15px" }}
          >
            Need Help?
          </h3>
          <p
            style={{ color: "#6b7280", margin: "0 0 15px 0", fontSize: "14px" }}
          >
            If you have any questions about this transaction or need assistance,
            please don't hesitate to contact us:
          </p>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "20px",
              flexWrap: "wrap",
            }}
          >
            <div style={{ color: "#3b82f6", fontSize: "14px" }}>
              📞 Customer Service: +256 789 529810 / +256 779 021565
            </div>
            <div style={{ color: "#3b82f6", fontSize: "14px" }}>
              📧 Email: bukonzounitedteacherssacco@gmail.com
            </div>
          </div>
        </div>

        <p
          style={{ fontSize: "16px", marginTop: "25px", marginBottom: "10px" }}
        >
          Thank you for banking with us!
        </p>

        <p style={{ fontSize: "14px", color: "#6b7280", margin: "0" }}>
          Best regards,
          <br />
          <strong> bukonzo Sacco </strong>
        </p>
      </div>

      {/* Footer */}
      <div
        style={{
          backgroundColor: "#374151",
          padding: "20px",
          textAlign: "center",
          borderRadius: "0 0 8px 8px",
        }}
      >
        <p style={{ color: "#d1d5db", margin: "0", fontSize: "12px" }}>
          This is an automated message. Please do not reply to this email.
          <br />© {new Date().getFullYear()} bukonzo Teachers Sacco Banking. All
          rights reserved.
        </p>
      </div>
    </div>
  );
};
