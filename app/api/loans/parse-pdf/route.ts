import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/config/auth';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Expected PDF.' },
        { status: 400 }
      );
    }

    // Convert file to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    console.log("PDF ArrayBuffer size:", arrayBuffer.byteLength);

    // Load the PDF document
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      disableFontFace: true,
      stopAtErrors: true,
      verbosity: 0,
      disableWorker: true,
    } as any);

    const pdf = await loadingTask.promise;
    console.log("PDF loaded, pages:", pdf.numPages);

    const parsedData: any[] = [];
    let rowNum = 0;

    // Parse each page
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const items = textContent.items;

      console.log(`Page ${pageNum}: ${items.length} text items`);

      // Group items into rows based on Y position
      const rowMap = new Map<number, any[]>();
      
      items.forEach((item: any) => {
        if ('str' in item && item.str.trim()) {
          const y = Math.round(item.transform[5]);
          if (!rowMap.has(y)) {
            rowMap.set(y, []);
          }
          rowMap.get(y)!.push(item);
        }
      });

      // Sort rows by Y position (top to bottom)
      const sortedRows = Array.from(rowMap.entries())
        .sort((a, b) => b[0] - a[0]);

      // Process each row
      for (const [_, rowItems] of sortedRows) {
        // Sort items in row by X position (left to right)
        const sortedItems = rowItems.sort((a, b) => a.transform[4] - b.transform[4]);
        const rowText = sortedItems.map(item => item.str.trim()).filter(Boolean);

        if (rowText.length > 0) {
          rowNum++;
          parsedData.push({
            rowNum,
            pageNum,
            text: rowText.join(' | '),
            items: rowText,
          });
        }
      }
    }

    console.log(`Total rows parsed: ${parsedData.length}`);

    return NextResponse.json({
      success: true,
      data: parsedData,
      count: parsedData.length,
    });

  } catch (error: any) {
    console.error('PDF parsing error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to parse PDF' 
      },
      { status: 500 }
    );
  }
}
