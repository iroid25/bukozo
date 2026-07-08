// Report Types and Interfaces

export type ReportCategory = 
  | 'SAVINGS' 
  | 'SHARES' 
  | 'FIXED_DEPOSITS' 
  | 'FINANCIAL' 
  | 'GENERAL' 
  | 'FIXED_ASSETS' 
  | 'TRANSACTIONS';

export type ExportFormat = 'PDF' | 'EXCEL' | 'CSV' | 'JSON';

export type ParameterType = 
  | 'date' 
  | 'dateRange' 
  | 'select' 
  | 'multiSelect' 
  | 'number' 
  | 'text'
  | 'boolean';

export interface ReportParameter {
  name: string;
  label: string;
  type: ParameterType;
  required: boolean;
  defaultValue?: any;
  options?: Array<{ label: string; value: string }>;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

export interface ReportConfig {
  id: string;
  name: string;
  description: string;
  category: ReportCategory;
  parameters: ReportParameter[];
  exportFormats: ExportFormat[];
  requiresAuth: boolean;
  allowedRoles?: string[];
}

export interface ReportData {
  title: string;
  description?: string;
  generatedAt: Date;
  parameters: Record<string, any>;
  data: any;
  summary?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface FinancialRecord {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  balance?: number;
  category?: string;
  ledgerType?: string;
}

export interface ReportExportOptions {
  format?: ExportFormat;
  filename?: string;
  orientation?: 'portrait' | 'landscape';
  pageSize?: 'A4' | 'Letter' | 'Legal';
  includeHeader?: boolean;
  includeFooter?: boolean;
}

// Common report parameter presets
export const CommonParameters = {
  dateRange: (): ReportParameter => ({
    name: 'dateRange',
    label: 'Date Range',
    type: 'dateRange',
    required: true,
  }),
  
  startDate: (): ReportParameter => ({
    name: 'startDate',
    label: 'Start Date',
    type: 'date',
    required: true,
  }),
  
  endDate: (): ReportParameter => ({
    name: 'endDate',
    label: 'End Date',
    type: 'date',
    required: true,
  }),
  
  branchId: (): ReportParameter => ({
    name: 'branchId',
    label: 'Branch',
    type: 'select',
    required: false,
  }),
  
  accountStatus: (): ReportParameter => ({
    name: 'status',
    label: 'Account Status',
    type: 'select',
    required: false,
    options: [
      { label: 'Active', value: 'ACTIVE' },
      { label: 'On Hold', value: 'ON_HOLD' },
      { label: 'Closed', value: 'CLOSED' },
      { label: 'Dormant', value: 'DORMANT' },
    ],
  }),
  
  exportFormat: (): ReportParameter => ({
    name: 'format',
    label: 'Export Format',
    type: 'select',
    required: true,
    defaultValue: 'PDF',
    options: [
      { label: 'PDF', value: 'PDF' },
      { label: 'Excel', value: 'EXCEL' },
      { label: 'CSV', value: 'CSV' },
    ],
  }),
};
