import * as React from "react";

type Props = {
  memberName: string;
  verificationCode: string;
  amount: number;
  fee: number;
  total: number;
  accountNumber: string;
  channel: string;
  expiresInMinutes?: number;
};

export default function WithdrawalVerificationEmailV2({
  memberName,
  verificationCode,
  amount,
  fee,
  total,
  accountNumber,
  channel,
  expiresInMinutes = 15,
}: Props) {
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(n);

  return (
    <div
      style={{
        fontFamily: "Arial, sans-serif",
        color: "#111827",
        lineHeight: 1.5,
        maxWidth: 600,
        margin: "0 auto",
        padding: 24,
        backgroundColor: "#ffffff",
      }}
    >
      <h2 style={{ margin: "0 0 8px", color: "#0f172a" }}>
        Withdrawal Verification
      </h2>
      <p style={{ margin: "0 0 16px" }}>Hello {memberName},</p>

      <p style={{ margin: "0 0 12px" }}>
        Use the verification code below to approve your withdrawal request.
      </p>

      <div
        style={{
          background: "#f5f7ff",
          border: "1px solid #dfe4ff",
          borderRadius: 8,
          padding: 16,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: 2,
            textAlign: "center",
          }}
        >
          {verificationCode}
        </div>
        <div
          style={{
            textAlign: "center",
            fontSize: 12,
            marginTop: 6,
            color: "#555",
          }}
        >
          Expires in {expiresInMinutes} minutes
        </div>
      </div>

      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 10,
          padding: 16,
          marginBottom: 16,
          backgroundColor: "#fafafa",
        }}
      >
        <div
          style={{
            fontWeight: 700,
            fontSize: 16,
            color: "#111827",
            marginBottom: 10,
          }}
        >
          Transaction Details
        </div>

        <table
          width="100%"
          cellPadding={0}
          cellSpacing={0}
          style={{ borderCollapse: "collapse" }}
        >
          <tbody>
            <tr>
              <td style={{ padding: "8px 0", color: "#555" }}>Account</td>
              <td
                style={{ padding: "8px 0", textAlign: "right", fontWeight: 600 }}
              >
                {accountNumber}
              </td>
            </tr>
            <tr>
              <td style={{ padding: "8px 0", color: "#555" }}>Channel</td>
              <td style={{ padding: "8px 0", textAlign: "right" }}>{channel}</td>
            </tr>
            <tr>
              <td style={{ padding: "8px 0", color: "#555" }}>Amount</td>
              <td style={{ padding: "8px 0", textAlign: "right" }}>
                {fmt(amount)}
              </td>
            </tr>
            <tr>
              <td style={{ padding: "8px 0", color: "#555" }}>Withdrawal Fee</td>
              <td style={{ padding: "8px 0", textAlign: "right" }}>
                {fmt(fee)}
              </td>
            </tr>
            <tr>
              <td
                style={{
                  padding: "10px 0 0",
                  color: "#111827",
                  fontWeight: 700,
                  borderTop: "1px solid #e5e7eb",
                }}
              >
                Total Deduction
              </td>
              <td
                style={{
                  padding: "10px 0 0",
                  textAlign: "right",
                  fontWeight: 700,
                  color: "#b91c1c",
                  borderTop: "1px solid #e5e7eb",
                }}
              >
                {fmt(total)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p style={{ margin: "0 0 8px", fontSize: 12, color: "#666" }}>
        Do not share your code with anyone. If you did not request this,
        contact support immediately.
      </p>

      <p style={{ margin: "16px 0 0", fontSize: 12, color: "#888" }}>
        Bukonzo Teachers SACCO
      </p>
    </div>
  );
}
