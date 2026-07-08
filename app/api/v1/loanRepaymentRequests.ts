// FILE: lib/api/loanRepaymentRequests.ts
export async function createRepaymentRequest(data: {
  loanId: string;
  accountId: string;
  amount: number;
  notes?: string;
}) {
  const response = await fetch("/api/loan-repayment-requests", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  return response.json();
}

export async function approveRepaymentRequest(
  token: string,
  verificationCode: string
) {
  const response = await fetch("/api/loan-repayment-requests/approve", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token, verificationCode }),
  });

  return response.json();
}

export async function rejectRepaymentRequest(token: string, reason: string) {
  const response = await fetch("/api/loan-repayment-requests/reject", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token, reason }),
  });

  return response.json();
}

export async function getAllRepaymentRequests() {
  const response = await fetch("/api/v1/loan-repayment-requests");
  return response.json();
}
