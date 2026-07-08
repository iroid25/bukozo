// Export all exporters
export { CSVExporter } from './csv-exporter';
export { ExcelExporter } from './excel-exporter';
export { PDFExporter } from './pdf-exporter';

import { ReportData, ReportExportOptions, ExportFormat } from '../types';
import { CSVExporter } from './csv-exporter';
import { ExcelExporter } from './excel-exporter';
import { PDFExporter } from './pdf-exporter';

/**
 * Main Report Exporter
 * Routes to appropriate exporter based on format
 */
export class ReportExporter {
  /**
   * Export report in specified format
   */
  static async export(
    reportData: ReportData,
    format: ExportFormat,
    options?: Omit<ReportExportOptions, 'format'>
  ): Promise<Response> {
    const exportOptions = {
      ...options,
      format,
    };

    switch (format) {
      case 'CSV':
        return CSVExporter.generateResponse(reportData, options?.filename);

      case 'EXCEL':
        return await ExcelExporter.generateResponse(reportData, options?.filename);

      case 'PDF':
        return await PDFExporter.generateResponse(reportData, options?.filename);

      case 'JSON':
        return this.exportJSON(reportData, options?.filename);

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Export as JSON
   */
  private static exportJSON(reportData: ReportData, filename?: string): Response {
    const fileName = filename || `${reportData.title.replace(/\s+/g, '_')}_${Date.now()}.json`;

    return new Response(JSON.stringify(reportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  }
}
