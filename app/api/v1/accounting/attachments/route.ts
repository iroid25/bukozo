import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { db } from "@/prisma/db";
import { UserRole } from "@prisma/client";
import { bumpAccountingSyncState } from "@/lib/services/accounting-sync";

function hasAccountingAccess(role?: string | null) {
  return ["ADMIN", "ACCOUNTANT", "BRANCHMANAGER", "TELLER", "LOANOFFICER"].includes(role || "");
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || !hasAccountingAccess(user.role)) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get("entityType") || undefined;
    const entityId = searchParams.get("entityId") || undefined;
    const transactionId = searchParams.get("transactionId") || undefined;
    const journalEntryId = searchParams.get("journalEntryId") || undefined;

    const attachments = await db.accountingAttachment.findMany({
      where: {
        ...(entityType ? { entityType } : {}),
        ...(entityId ? { entityId } : {}),
        ...(transactionId ? { transactionId } : {}),
        ...(journalEntryId ? { journalEntryId } : {}),
      },
      include: {
        uploadedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { uploadedAt: "desc" },
    });

    return NextResponse.json({ success: true, data: attachments });
  } catch (error) {
    console.error("Error fetching accounting attachments:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch attachments" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || !hasAccountingAccess(user.role)) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const entityType = String(body.entityType || "").trim();
    const entityId = String(body.entityId || "").trim();
    const fileName = String(body.fileName || "").trim();
    const fileUrl = String(body.fileUrl || "").trim();

    if (!entityType || !entityId || !fileName || !fileUrl) {
      return NextResponse.json({ success: false, error: "entityType, entityId, fileName, and fileUrl are required" }, { status: 400 });
    }

    const transactionId = body.transactionId ? String(body.transactionId).trim() : null;
    const journalEntryId = body.journalEntryId ? String(body.journalEntryId).trim() : null;

    const attachment = await db.accountingAttachment.create({
      data: {
        entityType,
        entityId,
        fileName,
        fileUrl,
        mimeType: body.mimeType ? String(body.mimeType) : null,
        fileSize: typeof body.fileSize === "number" ? body.fileSize : body.fileSize ? Number(body.fileSize) : null,
        description: body.description ? String(body.description) : null,
        uploadedByUserId: user.id,
        transactionId,
        journalEntryId,
      },
      include: {
        uploadedBy: { select: { id: true, name: true, email: true } },
      },
    });

    void bumpAccountingSyncState("Accounting attachment added");

    return NextResponse.json({ success: true, data: attachment }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating accounting attachment:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create attachment" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || !hasAccountingAccess(user.role)) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, error: "ID is required" }, { status: 400 });
    }

    const attachment = await db.accountingAttachment.findUnique({ where: { id } });
    if (!attachment) {
      return NextResponse.json({ success: false, error: "Attachment not found" }, { status: 404 });
    }

    if (user.role !== UserRole.ADMIN && attachment.uploadedByUserId !== user.id) {
      return NextResponse.json({ success: false, error: "You can only delete your own attachments" }, { status: 403 });
    }

    await db.accountingAttachment.delete({ where: { id } });
    void bumpAccountingSyncState("Accounting attachment deleted");

    return NextResponse.json({ success: true, message: "Attachment deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting accounting attachment:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete attachment" },
      { status: 500 },
    );
  }
}
