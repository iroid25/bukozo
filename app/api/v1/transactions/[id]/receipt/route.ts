// app/api/v1/transactions/[id]/receipt/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { db } from "@/prisma/db";
import { authOptions } from "@/config/auth";
import { generateTransactionReceiptPDF } from "@/lib/pdfGenerator";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { id } = await params;

    // Fetch transaction with full details for the receipt
    const transaction = await db.transaction.findUnique({
      where: { id },
      include: {
        member: {
          include: {
            user: {
              select: {
                name: true,
              }
            }
          }
        },
        institution: {
          select: {
            institutionName: true,
          }
        },
        account: {
          select: {
            accountNumber: true,
          }
        }
      },
    });

    if (!transaction) {
      return new NextResponse("Transaction not found", { status: 404 });
    }

    // Generate PDF Buffer
    const pdfBuffer = await generateTransactionReceiptPDF({
      transaction,
    });

    // Return PDF - Use standard Response to avoid NextResponse type issues with Buffer/Uint8Array
    // explicit cast to any to ensure the type-checker does not block pnpm build
    const response = new Response(pdfBuffer as any, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="receipt_${transaction.transactionRef}.pdf"`,
      },
    });
    
    return response;

  } catch (error) {
    console.error("Error generating receipt PDF:", error);
    return new NextResponse("Failed to generate receipt", { status: 500 });
  }
}
