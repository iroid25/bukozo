// @ts-ignore
import { ReportData, ReportExportOptions } from '../types';

/**
 * PDF Exporter
 * Exports report data to PDF format using jsPDF
 * Note: Install jsPDF: pnpm add jspdf jspdf-autotable
 */
export class PDFExporter {
  /**
   * Export report data to PDF buffer
   * This is a placeholder - requires jsPDF to be installed
   */
  static async export(reportData: ReportData, options?: ReportExportOptions): Promise<Buffer> {
    const { jsPDF } = await import('jspdf');
    // @ts-ignore
    await import('jspdf-autotable');
    
    const doc = new jsPDF({
      orientation: options?.orientation || 'portrait',
      unit: 'mm',
      format: options?.pageSize || 'a4',
    });

    // Add SACCO Branding
    doc.setFontSize(22);
    doc.setTextColor(30, 58, 138); // Indigo 900
    doc.text('Bukonzo Teachers SACCO', 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('Empowering Teachers for a Better Future', 14, 26);
    
    // Add report title
    doc.setFontSize(16);
    doc.setTextColor(0);
    doc.text(reportData.title, 14, 40);

    // Add generation metadata
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Generated On: ${new Date().toLocaleString('en-UG')}`, 14, 46);
    if (reportData.summary?.statementPeriod) {
       doc.text(`Period: ${reportData.summary.statementPeriod}`, 14, 51);
    }

    // Add data table
    if (Array.isArray(reportData.data) && reportData.data.length > 0) {
      const headers = Object.keys(reportData.data[0]);
      const rows = reportData.data.map(row => headers.map(h => {
          const val = row[h];
          if (val instanceof Date) return val.toLocaleDateString();
          return String(val ?? '-');
      }));

      (doc as any).autoTable({
        head: [headers.map(h => h.charAt(0).toUpperCase() + h.slice(1).replace(/([A-Z])/g, ' $1'))],
        body: rows,
        startY: 60,
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [249, 250, 251] },
        margin: { top: 60 },
      });
    }

    // Add summary if available
    const finalY = (doc as any).lastAutoTable?.finalY || 60;
    if (reportData.summary) {
      const startY = finalY + 15;
      
      // Draw a box for summary
      doc.setDrawColor(229, 231, 235);
      doc.setFillColor(255, 255, 255);
      
      doc.setFontSize(12);
      doc.setTextColor(30, 58, 138);
      doc.text('Summary Overview', 14, startY);
      
      doc.setFontSize(10);
      doc.setTextColor(50);
      let y = startY + 8;
      
      Object.entries(reportData.summary).forEach(([key, value]) => {
        if (key === 'statementPeriod') return; // Already in header
        
        const label = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
        doc.setFont('helvetica', 'bold');
        doc.text(`${label}:`, 14, y);
        doc.setFont('helvetica', 'normal');
        doc.text(String(value), 60, y);
        y += 6;
      });
    }

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });
        doc.text('Bukonzo Teachers SACCO - Official Statement', 14, doc.internal.pageSize.height - 10);
    }

    return Buffer.from(doc.output('arraybuffer'));
  }

  /**
   * Generate PDF download response
   */
  static async generateResponse(reportData: ReportData, filename?: string): Promise<Response> {
    const buffer = await this.export(reportData);
    const fileName = filename || `${reportData.title.replace(/\s+/g, '_')}_${Date.now()}.pdf`;

    return new Response(buffer as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  }
}
