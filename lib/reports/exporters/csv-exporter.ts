import { ReportData, ReportExportOptions } from '../types';

/**
 * CSV Exporter
 * Exports report data to CSV format
 */
export class CSVExporter {
  /**
   * Convert report data to CSV
   */
  static export(reportData: ReportData, options?: ReportExportOptions): string {
    const { data } = reportData;
    
    // Handle array of objects
    if (Array.isArray(data) && data.length > 0) {
      return this.arrayToCSV(data);
    }
    
    // Handle single object
    if (typeof data === 'object' && !Array.isArray(data)) {
      return this.objectToCSV(data);
    }
    
    throw new Error('Invalid data format for CSV export');
  }

  /**
   * Convert array of objects to CSV
   */
  private static arrayToCSV(data: any[]): string {
    if (data.length === 0) return '';

    // Get headers from first object
    const headers = Object.keys(data[0]);
    const csvHeaders = headers.join(',');

    // Convert rows
    const csvRows = data.map(row => {
      return headers.map(header => {
        const value = row[header];
        // Escape quotes and wrap in quotes if contains comma
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      }).join(',');
    });

    return [csvHeaders, ...csvRows].join('\n');
  }

  /**
   * Convert object to CSV (key-value pairs)
   */
  private static objectToCSV(data: Record<string, any>): string {
    const rows = Object.entries(data).map(([key, value]) => {
      const stringValue = value === null || value === undefined ? '' : String(value);
      if (stringValue.includes(',') || stringValue.includes('"')) {
        return `${key},"${stringValue.replace(/"/g, '""')}"`;
      }
      return `${key},${stringValue}`;
    });

    return ['Key,Value', ...rows].join('\n');
  }

  /**
   * Generate CSV download response
   */
  static generateResponse(reportData: ReportData, filename?: string): Response {
    const csv = this.export(reportData);
    const fileName = filename || `${reportData.title.replace(/\s+/g, '_')}_${Date.now()}.csv`;

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  }
}
