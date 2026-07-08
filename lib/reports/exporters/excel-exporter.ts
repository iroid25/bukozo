import { ReportData, ReportExportOptions } from '../types';
import ExcelJS from 'exceljs';

/**
 * Excel Exporter
 * Exports report data to Excel format using ExcelJS
 */
export class ExcelExporter {
  /**
   * Export report data to Excel buffer
   */
  static async export(reportData: ReportData, options?: ReportExportOptions): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Report');

    // Add metadata
    worksheet.mergeCells('A1:E1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = reportData.title;
    titleCell.font = { size: 16, bold: true };
    titleCell.alignment = { horizontal: 'center' };

    worksheet.mergeCells('A2:E2');
    const subtitleCell = worksheet.getCell('A2');
    subtitleCell.value = reportData.description || '';
    subtitleCell.font = { size: 12, italic: true };
    subtitleCell.alignment = { horizontal: 'center' };

    worksheet.addRow([]); // Spacer
    worksheet.addRow([`Generated: ${new Date(reportData.generatedAt).toLocaleString()}`]);
    worksheet.addRow([]); // Spacer

    // Determine columns based on data
    let columns: string[] = [];
    let rows: any[] = [];

    // Handle different data structures
    if (Array.isArray(reportData.data)) {
      rows = reportData.data;
      if (rows.length > 0) {
        columns = Object.keys(rows[0]);
      }
    } else if (typeof reportData.data === 'object') {
      // If data is an object (e.g. wrapper), try to find the array property
      const arrayProp = Object.entries(reportData.data).find(([_, value]) => Array.isArray(value));
      if (arrayProp) {
        rows = arrayProp[1] as any[];
        if (rows.length > 0) {
          columns = Object.keys(rows[0]);
        }
      } else {
        // Fallback for object with no array (e.g. just summary stats)
        columns = Object.keys(reportData.data);
        rows = [reportData.data];
      }
    }

    if (columns.length > 0) {
      // Add Headers
      const headerRow = worksheet.addRow(columns.map(c => 
        c.replace(/([A-Z])/g, ' $1').trim().replace(/^\w/, c => c.toUpperCase()) // Readable headers
      ));
      
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      // Add Data
      rows.forEach(row => {
        const rowData = columns.map(col => {
            const val = row[col];
            // Format check
            if (typeof val === 'object' && val !== null) return JSON.stringify(val);
            return val;
        });
        worksheet.addRow(rowData);
      });

      // Auto-fit columns (simplified)
      worksheet.columns.forEach((column, i) => {
        let maxLength = 0;
        column.eachCell && column.eachCell({ includeEmpty: true }, (cell) => {
          const columnLength = cell.value ? cell.value.toString().length : 10;
          if (columnLength > maxLength) {
            maxLength = columnLength;
          }
        });
        column.width = Math.min(Math.max(maxLength, 10), 50); // Min 10, Max 50
      });
    }

    // Add Summary Section if exists
    if (reportData.summary) {
      worksheet.addRow([]);
      worksheet.addRow(['Report Summary']);
      const summaryHeader = worksheet.lastRow;
      if (summaryHeader) summaryHeader.font = { bold: true, size: 14 };

      Object.entries(reportData.summary).forEach(([key, value]) => {
         // Format key
         const label = key.replace(/([A-Z])/g, ' $1').trim().replace(/^\w/, c => c.toUpperCase());
         
         // Format value
         let displayValue = value;
         if (typeof value === 'object') displayValue = JSON.stringify(value);

         worksheet.addRow([label, displayValue]);
      });
    }

    // Write to buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Generate Excel download response
   */
  static async generateResponse(reportData: ReportData, filename?: string): Promise<Response> {
    const buffer = await this.export(reportData);
    const fileName = filename || `${reportData.title.replace(/\s+/g, '_')}_${Date.now()}.xlsx`;

    return new Response(buffer as any, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  }
}
