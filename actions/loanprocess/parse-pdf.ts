"use server";

import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

// No global workerSrc set here; we'll handle it inside the action if needed, 
// or rely on disableWorker: true.

export interface ExtractedLoanData {
  name: string;
  loanAmount: number;
  totalInterest: number;
  disbursementDate: string;
  expiryDate: string;
  outstandingPrincipal: number;
  outstandingInterest: number;
  outstandingPenalty: number;
  outstandingTotal: number;
  refNo: string;
  rowNumber: number;
}

// Configure PDF.js for Node.js environment
// We don't need to set workerSrc for Node.js usage usually, strictly relying on existing imports

export async function parsePdfAction(formData: FormData): Promise<{ success: boolean; data?: ExtractedLoanData[]; error?: string }> {
  try {
    const file = formData.get('file') as File;
    
    if (!file) {
      return { success: false, error: "No file provided" };
    }
    
    const arrayBuffer = await file.arrayBuffer();
    console.log("PDF ArrayBuffer size:", arrayBuffer.byteLength);

    // Load the document
    const loadingTask = pdfjsLib.getDocument({ 
      data: new Uint8Array(arrayBuffer),
      disableFontFace: true,
      stopAtErrors: true,
      verbosity: 0,
      disableWorker: true, // Forces "fake worker" (Node friendly)
    } as any);
    
    const pdf = await loadingTask.promise;
    console.log("PDF loaded, pages:", pdf.numPages);
    
    const allTextItems: any[] = [];
    
    // Extract text from all pages
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      console.log(`Page ${pageNum} items:`, textContent.items.length);

      // Add page number to each text item for reference
      textContent.items.forEach((item: any) => {
        allTextItems.push({
          ...item,
          pageNum,
          text: item.str,
          x: item.transform[4],
          y: item.transform[5],
        });
      });
    }
    
    // Extract unique pages
    const pages = [...new Set(allTextItems.map(item => item.pageNum))].sort((a,b) => a-b);
    
    // 1. Find header row to identify column positions (usually on page 1)
    let headerRow: any = null;
    let columnPositions: Map<string, number> = new Map();
    
    for (const pageNum of pages) {
      const pageItems = allTextItems.filter(item => item.pageNum === pageNum);
      const pageRows = groupTextIntoRows(pageItems);
      const found = findHeaderRow(pageRows);
      if (found) {
        headerRow = { ...found, pageNum };
        columnPositions = extractColumnPositions(headerRow);
        break;
      }
    }
    
    if (!headerRow) {
      return { success: false, error: 'Could not find table header in PDF. Ensure it contains columns like "Name", "Loan Amount", "Disbursement Date".' };
    }
    
    // 2. Parse data rows PAGE BY PAGE to avoid merging rows from different pages with same Y-coord
    const loanData: ExtractedLoanData[] = [];
    
    pages.forEach(pageNum => {
      const pageItems = allTextItems.filter(item => item.pageNum === pageNum);
      const pageRows = groupTextIntoRows(pageItems);
      
      // If we are on the header page, start parsing after the header row index
      // Otherwise, parse all rows (some might be discarded if they don't look like data)
      const startAtIdx = (pageNum === headerRow.pageNum) ? headerRow.rowIndex : -1;
      const dataRows = parseDataRows(pageRows, columnPositions, startAtIdx);
      
      loanData.push(...dataRows);
    });
    
    // Re-index row numbers globally
    loanData.forEach((item, index) => {
      item.rowNumber = index + 1;
    });
    
    // Simple serialization to ensure it passes back to client cleanly
    const serializedData = JSON.parse(JSON.stringify(loanData));
    
    return { success: true, data: serializedData };
  } catch (error) {
    console.error('Server-side PDF parsing error:', error);
    return { success: false, error: `Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

// Helper functions (copied from lib/pdf-parser.ts but kept local to module)

function groupTextIntoRows(textItems: any[], tolerance: number = 5): any[] {
  // Sort by Y coordinate (top to bottom)
  const sorted = [...textItems].sort((a, b) => b.y - a.y);
  
  const rows: any[] = [];
  let currentRow: any[] = [];
  let currentY = sorted[0]?.y;
  
  sorted.forEach((item) => {
    if (Math.abs(item.y - currentY) <= tolerance) {
      currentRow.push(item);
    } else {
      if (currentRow.length > 0) {
        rows.push({
          y: currentY,
          items: currentRow.sort((a, b) => a.x - b.x), // Sort left to right
          rowIndex: rows.length,
        });
      }
      currentRow = [item];
      currentY = item.y;
    }
  });
  
  // Add last row
  if (currentRow.length > 0) {
    rows.push({
      y: currentY,
      items: currentRow.sort((a, b) => a.x - b.x),
      rowIndex: rows.length,
    });
  }
  
  return rows;
}

function findHeaderRow(rows: any[]): any | null {
  // Look for row containing key column headers
  const headerKeywords = ['Name', 'Loan Amount', 'Disbursement Date', 'Expiry Date'];
  
  for (const row of rows) {
    const rowText = row.items.map((item: any) => item.text).join(' ');
    const matchCount = headerKeywords.filter(keyword => 
      rowText.includes(keyword)
    ).length;
    
    if (matchCount >= 2) {
      return row;
    }
  }
  
  return null;
}

function extractColumnPositions(headerRow: any): Map<string, number> {
  const positions = new Map<string, number>();
  
  const columnNames = [
    'Name',
    'Loan Amount',
    'Total Interest',
    'Disbursement Date',
    'Expiry Date',
    'Principal',
    'Interest',
    'Penalty',
    'Total',
    'Ref. No.',
  ];
  
  headerRow.items.forEach((item: any) => {
    const text = item.text.trim();
    for (const colName of columnNames) {
      if (text.includes(colName) || colName.includes(text)) {
        positions.set(colName, item.x);
      }
    }
  });
  
  return positions;
}

function parseDataRows(
  rows: any[],
  columnPositions: Map<string, number>,
  headerRowIndex: number
): ExtractedLoanData[] {
  const loanData: ExtractedLoanData[] = [];
  
  // Process rows after header
  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    
    // Skip rows that are too short (likely not data rows)
    if (row.items.length < 3) continue;
    
    // Extract data by matching X positions to columns
    const rowData = extractRowData(row, columnPositions);
    
    // Validate that we have essential data
    if (rowData.name && rowData.loanAmount > 0) {
      loanData.push({
        ...rowData,
        rowNumber: i - headerRowIndex,
      });
    }
  }
  
  return loanData;
}

function extractRowData(row: any, columnPositions: Map<string, number>): any {
  const tolerance = 30; // X-coordinate tolerance for column matching
  
  const findValueNearColumn = (columnName: string): string => {
    const columnX = columnPositions.get(columnName);
    if (!columnX) return '';
    
    const nearbyItems = row.items.filter((item: any) => 
      Math.abs(item.x - columnX) <= tolerance
    );
    
    return nearbyItems.map((item: any) => item.text).join(' ').trim();
  };
  
  return {
    name: findValueNearColumn('Name'),
    loanAmount: parseFloat(findValueNearColumn('Loan Amount').replace(/,/g, '')) || 0,
    totalInterest: parseFloat(findValueNearColumn('Total Interest').replace(/,/g, '')) || 0,
    disbursementDate: findValueNearColumn('Disbursement Date'),
    expiryDate: findValueNearColumn('Expiry Date'),
    outstandingPrincipal: parseFloat(findValueNearColumn('Principal').replace(/,/g, '')) || 0,
    outstandingInterest: parseFloat(findValueNearColumn('Interest').replace(/,/g, '')) || 0,
    outstandingPenalty: parseFloat(findValueNearColumn('Penalty').replace(/,/g, '')) || 0,
    outstandingTotal: parseFloat(findValueNearColumn('Total').replace(/,/g, '')) || 0,
    refNo: findValueNearColumn('Ref. No.'),
  };
}
