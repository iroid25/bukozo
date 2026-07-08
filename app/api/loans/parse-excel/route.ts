import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/config/auth';
import * as XLSX from 'xlsx';
import { db } from '@/prisma/db';

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
    const validTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv'
    ];

    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Expected Excel or CSV.' },
        { status: 400 }
      );
    }

    // Convert file to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    
    // Parse Excel file
    const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON, skipping header rows (start at row 14 for the template)
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
      range: 13,
      defval: "",
      raw: false 
    });

    console.log(`Excel parsed: ${jsonData.length} rows`);

    // Fetch products for preview
    const products = await db.loanProduct.findMany({
      where: { isActive: true },
      select: { id: true, name: true, interestRate: true }
    });

    // Helper function to clean number strings
    const cleanNumber = (val: any): number => {
      const str = String(val || "").replace(/,/g, '').trim();
      return parseFloat(str) || 0;
    };

    // Parse each row
    const parsedRows = jsonData.map((item: any, index: number) => {
      const rowNum = index + 1;

      // Extract member info from template columns
      const rawMemberNum = String(item["__EMPTY_2"] || "").trim();
      const rawName = String(item["__EMPTY_8"] || "").trim();
      const displayMember = rawMemberNum || rawName || "Unknown";

      // Use first product for preview
      const product = products.length > 0 ? products[0] : null;

      // Extract financial figures
      const amountGranted = cleanNumber(item["__EMPTY_20"]);
      const outstandingTotal = cleanNumber(item["__EMPTY_65"]);
      const outstandingPrincipal = cleanNumber(item["__EMPTY_52"]);
      const outstandingInterest = cleanNumber(item["__EMPTY_57"]);
      const outstandingBalance = outstandingTotal || outstandingPrincipal || amountGranted;

      // Parse dates
      const disburseDateKey = Object.keys(item).find(k => k.includes("Disburse"));
      const expiryDateKey = "__EMPTY_31";

      let dateDisbursed: Date | undefined;
      let expiryDate: Date | undefined;

      // Parse disbursement date
      if (disburseDateKey && item[disburseDateKey]) {
        const dateStr = String(item[disburseDateKey]).trim();
        if (dateStr && dateStr !== "") {
          if (dateStr.includes("/")) {
            const parts = dateStr.split("/");
            if (parts.length === 3) {
              const day = parseInt(parts[0]);
              const month = parseInt(parts[1]) - 1;
              const year = parseInt(parts[2]);
              const tempDate = new Date(year, month, day);
              if (!isNaN(tempDate.getTime())) {
                dateDisbursed = tempDate;
              }
            }
          } else {
            const tempDate = new Date(item[disburseDateKey]);
            if (!isNaN(tempDate.getTime())) {
              dateDisbursed = tempDate;
            }
          }
        }
      }

      // Parse expiry date
      if (item[expiryDateKey]) {
        const dateStr = String(item[expiryDateKey]).trim();
        if (dateStr && dateStr !== "") {
          if (dateStr.includes("/")) {
            const parts = dateStr.split("/");
            if (parts.length === 3) {
              const day = parseInt(parts[0]);
              const month = parseInt(parts[1]) - 1;
              const year = parseInt(parts[2]);
              const tempDate = new Date(year, month, day);
              if (!isNaN(tempDate.getTime())) {
                expiryDate = tempDate;
              }
            }
          } else {
            const tempDate = new Date(item[expiryDateKey]);
            if (!isNaN(tempDate.getTime())) {
              expiryDate = tempDate;
            }
          }
        }
      }

      // Calculate period
      let period = 12;
      if (dateDisbursed && expiryDate && !isNaN(dateDisbursed.getTime()) && !isNaN(expiryDate.getTime())) {
        const diffTime = Math.abs(expiryDate.getTime() - dateDisbursed.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        period = Math.ceil(diffDays / 30);
      }

      // Calculate interest rate
      let rate = 0;
      if (outstandingPrincipal > 0 && outstandingInterest > 0) {
        rate = (outstandingInterest / outstandingPrincipal) * 100;
      } else if (product) {
        rate = product.interestRate;
      }

      // Validation
      let status: "VALID" | "ERROR" = "VALID";
      let errorMsg = "";

      if (!rawMemberNum && !rawName) {
        status = "ERROR";
        errorMsg += "No member identifier. ";
      }
      if (!outstandingBalance || outstandingBalance <= 0) {
        status = "ERROR";
        errorMsg += "Invalid balance. ";
      }
      if (!dateDisbursed || isNaN(dateDisbursed.getTime())) {
        status = "ERROR";
        errorMsg += "Invalid date. ";
      }

      return {
        rowNum,
        memberNumber: displayMember,
        memberName: rawName,
        productName: product?.name || "Default Loan",
        amountGranted: isNaN(amountGranted) ? 0 : amountGranted,
        outstandingBalance: isNaN(outstandingBalance) ? 0 : outstandingBalance,
        dateDisbursed: dateDisbursed?.toISOString(),
        period: isNaN(period) ? 12 : period,
        rate: isNaN(rate) ? 0 : rate,
        notes: rawName ? `Name: ${rawName}` : `ID: ${rawMemberNum}`,
        status,
        errorMsg,
        productId: product?.id,
      };
    });

    return NextResponse.json({
      success: true,
      data: parsedRows,
      count: parsedRows.length,
    });

  } catch (error: any) {
    console.error('Excel parsing error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to parse Excel file'
      },
      { status: 500 }
    );
  }
}
