import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { normalizeFingerprintTemplate } from "@/lib/fingerprint";
import { loadFingerprintMemberRow } from "@/lib/fingerprint-db";
import { db } from "@/prisma/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowedRoles = new Set([
      "ADMIN",
      "BRANCHMANAGER",
      "TELLER",
      "DATA_ENTRANT",
      "ACCOUNTANT",
      "AGENT",
      "LOANOFFICER",
    ]);

    if (!allowedRoles.has(String(user.role))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    console.log("[fingerprint:template] request", { id });
    const member = await loadFingerprintMemberRow(id);

    if (!member) {
      console.warn("[fingerprint:template] member not found", { id });
      return NextResponse.json({ error: "Member not found." }, { status: 404 });
    }

    const template = normalizeFingerprintTemplate(member.fingerprintTemplate);
    console.log("[fingerprint:template] member loaded", {
      memberId: member.id,
      memberNumber: member.memberNumber,
      templateLength: template.length,
      templatePreview: template.slice(0, 16),
      balance: member.balance,
    });

    if (!template) {
      console.warn("[fingerprint:template] no template enrolled", {
        memberId: member.id,
        memberNumber: member.memberNumber,
      });
      return NextResponse.json(
        { error: "No fingerprint enrolled for this member. Enroll first." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      template,
      name: member.memberName || member.memberNumber,
      balance: Number(member.balance || 0),
      fingerprintQuality: member.fingerprintQuality,
      fingerprintEnrolledAt: member.fingerprintEnrolledAt,
      email: member.email || null,
    });
  } catch (error) {
    console.error("Error loading fingerprint template:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load fingerprint template.",
      },
      { status: 500 },
    );
  }
}

// DELETE — clear stored fingerprint template (ADMIN only, diagnostic use)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthUser();
    if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    console.log("[fingerprint:template] DELETE — clearing template for", id);

    await db.$executeRaw`
      UPDATE "Member"
      SET "fingerprintTemplate" = NULL,
          "fingerprintQuality" = NULL,
          "fingerprintEnrolledAt" = NULL
      WHERE "id" = ${id} OR "memberNumber" = ${id} OR "userId" = ${id}
    `;

    console.log("[fingerprint:template] template cleared for", id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[fingerprint:template] DELETE error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to clear template." },
      { status: 500 },
    );
  }
}
