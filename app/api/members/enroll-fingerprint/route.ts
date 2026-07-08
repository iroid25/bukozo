import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { db } from "@/prisma/db";
import { findFingerprintConflict } from "@/lib/fingerprint-uniqueness";
import { normalizeFingerprintTemplate } from "@/lib/fingerprint";
import {
  insertFingerprintLog,
  updateMemberFingerprintMetadata,
} from "@/lib/fingerprint-db";

export async function POST(req: NextRequest) {
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
    ]);

    if (!allowedRoles.has(String(user.role))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const memberId = String(body.memberId || "");
    const cleanTemplate = normalizeFingerprintTemplate(body.templateBase64);
    const quality =
      typeof body.quality === "number"
        ? Math.max(0, Math.min(100, Math.round(body.quality)))
        : null;

    console.log(
      "[enroll] received templateBase64 length:",
      cleanTemplate.length,
      "decoded bytes:",
      cleanTemplate ? Buffer.from(cleanTemplate, "base64").length : 0,
      "preview:",
      cleanTemplate.slice(0, 16),
    );

    if (!memberId || !cleanTemplate) {
      return NextResponse.json(
        { error: "memberId and templateBase64 are required." },
        { status: 400 },
      );
    }

    if (quality === null) {
      return NextResponse.json(
        { error: "Fingerprint quality is required." },
        { status: 400 },
      );
    }

    const templateBytes = Buffer.from(cleanTemplate, "base64").length;
    if (templateBytes !== 400) {
      return NextResponse.json(
        {
          error: `Invalid template: ${templateBytes} bytes (expected 400). Is the fingerprint bridge running? Re-enroll after starting bridge/server.js.`,
          templateBytes,
        },
        { status: 422 },
      );
    }

    if (quality < 60) {
      return NextResponse.json(
        {
          error: `Fingerprint quality too low (${quality}/100). Ask the member to rescan.`,
        },
        { status: 422 },
      );
    }

    const member = await db.member.findUnique({
      where: { id: memberId },
      select: { id: true, memberNumber: true, userId: true },
    });

    if (!member) {
      return NextResponse.json({ error: "Member not found." }, { status: 404 });
    }

    let conflict;
    try {
      conflict = await findFingerprintConflict(cleanTemplate, {
        excludeMemberId: member.id,
      });
    } catch {
      console.warn(
        "Fingerprint uniqueness check skipped because the bridge is unavailable.",
      );
    }

    if (conflict) {
      return NextResponse.json(
        {
          error: `This fingerprint is already enrolled to ${conflict.user?.name || "another member"} (${conflict.memberNumber}).`,
        },
        { status: 409 },
      );
    }

    await db.member.update({
      where: { id: member.id },
      data: {
        fingerprintTemplate: cleanTemplate,
      },
    });

    await updateMemberFingerprintMetadata({
      memberId: member.id,
      template: cleanTemplate,
      quality,
    });

    await insertFingerprintLog({
      memberId: member.id,
      action: "ENROLL",
      quality,
      ipAddress:
        req.headers.get("x-forwarded-for") ||
        req.headers.get("x-real-ip") ||
        "",
    });

    return NextResponse.json({
      success: true,
      memberId: member.id,
      warnings: [
        "Fingerprint uniqueness could not be verified because the bridge is not running.",
      ],
    });
  } catch (error) {
    console.error("Error enrolling fingerprint:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Fingerprint enrollment failed.",
      },
      { status: 500 },
    );
  }
}
