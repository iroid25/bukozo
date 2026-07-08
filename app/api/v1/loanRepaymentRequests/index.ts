// FILE: app/api/v1/loanRepaymentRequests/index.ts
"use client";

export async function createRepaymentRequest(data: {
  loanId: string;
  accountId: string;
  amount: number;
  notes?: string;
}) {

  try {

    const response = await fetch("/api/v1/loanRepaymentRequests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });


    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: result.error || "Failed to create repayment request",
      };
    }

    return result;
  } catch (error) {
    console.error("âŒ Fetch error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error occurred",
    };
  }
}

export async function verifyRepaymentCode(
  requestId: string,
  verificationCode: string
) {
  console.log("✅ Verifying repayment code", {
    requestId,
    verificationCode,
  });

  try {

    const response = await fetch("/api/v1/loanRepaymentRequests/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ requestId, verificationCode }),
    });


    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: result.error || "Failed to verify code",
      };
    }

    return result;
  } catch (error) {
    console.error("âŒ Fetch error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error occurred",
    };
  }
}
