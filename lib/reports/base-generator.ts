import { ReportData, ReportExportOptions } from './types';

/**
 * Base Report Generator Class
 * All specific report generators should extend this class
 */
export abstract class BaseReportGenerator {
  protected reportTitle: string;
  protected reportDescription: string;

  constructor(title: string, description: string) {
    this.reportTitle = title;
    this.reportDescription = description;
  }

  /**
   * Generate report data
   * Must be implemented by each specific report
   */
  abstract generateData(params: Record<string, any>): Promise<any>;

  /**
   * Validate report parameters
   */
  protected validateParameters(params: Record<string, any>, required: string[]): void {
    for (const param of required) {
      if (!params[param]) {
        throw new Error(`Missing required parameter: ${param}`);
      }
    }
  }

  /**
   * Format date for display
   */
  protected formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  /**
   * Format currency
   */
  protected formatCurrency(amount: number, currency: string = 'UGX'): string {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(amount);
  }

  /**
   * Format number
   */
  protected formatNumber(value: number, decimals: number = 2): string {
    return new Intl.NumberFormat('en-UG', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  }

  /**
   * Calculate percentage
   */
  protected calculatePercentage(value: number, total: number): number {
    if (total === 0) return 0;
    return (value / total) * 100;
  }

  /**
   * Build complete report data structure
   */
  protected async buildReportData(
    params: Record<string, any>,
    data: any,
    summary?: Record<string, any>
  ): Promise<ReportData> {
    return {
      title: this.reportTitle,
      generatedAt: new Date(),
      parameters: params,
      data,
      summary,
      metadata: {
        description: this.reportDescription,
        generatedBy: params.userId || 'System',
      },
    };
  }
}

/**
 * Report Registry
 * Manages all available reports
 */
export class ReportRegistry {
  private static reports = new Map<string, any>();

  static register(reportId: string, generator: any) {
    this.reports.set(reportId, generator);
  }

  static get(reportId: string): any {
    return this.reports.get(reportId);
  }

  static getAll(): Map<string, any> {
    return this.reports;
  }

  static exists(reportId: string): boolean {
    return this.reports.has(reportId);
  }
}
