// lib/api/statements.ts
// Client-side API helper functions for statements

const API_BASE = "/api/v1/statements";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Get all statements
 */
export async function getAllStatements(filters?: {
  memberId?: string;
  startDate?: string;
  endDate?: string;
}) {
  try {
    const params = new URLSearchParams();
    if (filters?.memberId) params.append("memberId", filters.memberId);
    if (filters?.startDate) params.append("startDate", filters.startDate);
    if (filters?.endDate) params.append("endDate", filters.endDate);

    const url = `${API_BASE}${params.toString() ? `?${params.toString()}` : ""}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to fetch statements");
    }

    return data;
  } catch (error: any) {
    console.error("Error fetching statements:", error);
    throw error;
  }
}

/**
 * Get statement by ID
 */
export async function getStatementById(id: string) {
  try {
    const response = await fetch(`${API_BASE}/${id}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to fetch statement");
    }

    return data;
  } catch (error: any) {
    console.error("Error fetching statement:", error);
    throw error;
  }
}

/**
 * Create a new statement
 */
export async function createStatement(payload: {
  memberId?: string;
  institutionId?: string;
  subjectType?: "MEMBER" | "INSTITUTION";
  scope?: "ALL_ACCOUNTS" | "SINGLE_ACCOUNT";
  accountId?: string;
  startDate: Date;
  endDate: Date;
  statementFee?: number;
  chargeAccountId?: string;
}) {
  try {
    const response = await fetch(API_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to create statement");
    }

    return data;
  } catch (error: any) {
    console.error("Error creating statement:", error);
    throw error;
  }
}

/**
 * Delete a statement
 */
export async function deleteStatement(id: string) {
  try {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: "DELETE",
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to delete statement");
    }

    return data;
  } catch (error: any) {
    console.error("Error deleting statement:", error);
    throw error;
  }
}

/**
 * Get members for statement generation
 */
export async function getMembersForStatements() {
  try {
    const response = await fetch(`${API_BASE}/members`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to fetch members");
    }

    return data;
  } catch (error: any) {
    console.error("Error fetching members:", error);
    throw error;
  }
}

export async function getInstitutionsForStatements() {
  try {
    const response = await fetch(`${API_BASE}/institutions`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to fetch institutions");
    }

    return data;
  } catch (error: any) {
    console.error("Error fetching institutions:", error);
    throw error;
  }
}

export async function getStatementAccounts(
  subjectType: "MEMBER" | "INSTITUTION",
  subjectId: string,
) {
  try {
    const params = new URLSearchParams({ subjectType, subjectId });
    const response = await fetch(`${API_BASE}/accounts?${params.toString()}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to fetch statement accounts");
    }

    return data;
  } catch (error: any) {
    console.error("Error fetching statement accounts:", error);
    throw error;
  }
}

export async function getStatementPreview(filters: {
  subjectType: "MEMBER" | "INSTITUTION";
  memberId?: string;
  institutionId?: string;
  accountId?: string;
  scope: "ALL_ACCOUNTS" | "SINGLE_ACCOUNT";
  startDate: string;
  endDate: string;
}) {
  try {
    const params = new URLSearchParams();
    params.append("subjectType", filters.subjectType);
    params.append("scope", filters.scope);
    params.append("startDate", filters.startDate);
    params.append("endDate", filters.endDate);
    if (filters.memberId) params.append("memberId", filters.memberId);
    if (filters.institutionId) {
      params.append("institutionId", filters.institutionId);
    }
    if (filters.accountId) params.append("accountId", filters.accountId);

    const response = await fetch(`${API_BASE}/preview?${params.toString()}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to generate statement preview");
    }

    return data;
  } catch (error: any) {
    console.error("Error generating statement preview:", error);
    throw error;
  }
}

/**
 * Get statement statistics
 */
export async function getStatementStatistics() {
  try {
    const response = await fetch(`${API_BASE}/statistics`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to fetch statistics");
    }

    return data;
  } catch (error: any) {
    console.error("Error fetching statistics:", error);
    throw error;
  }
}

/**
 * Get statement data (transactions, deposits, etc.)
 */
export async function getStatementData(id: string) {
  try {
    const response = await fetch(`${API_BASE}/${id}/data`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to fetch statement data");
    }

    return data;
  } catch (error: any) {
    console.error("Error fetching statement data:", error);
    throw error;
  }
}

/**
 * Send statement via email
 */
export async function sendStatementEmail(
  id: string,
  payload: {
    recipientEmail: string;
    recipientName: string;
    memberNumber: string;
    periodStart: Date;
    periodEnd: Date;
    pdfBase64: string;
    filename: string;
  }
) {
  try {
    const response = await fetch(`${API_BASE}/${id}/email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to send email");
    }

    return data;
  } catch (error: any) {
    console.error("Error sending email:", error);
    throw error;
  }
}
