export interface ImportAccountRow {
  accountNumber: string;
  memberNumber?: string;
  institutionNumber?: string;
  accountTypeName: string;
  branchName?: string;
  balance: number;
  openedAt?: string | Date;
}

export interface ImportResult {
  total: number;
  success: number;
  failed: number;
  errors: Array<{ row: number; error: string; data: any }>;
}
