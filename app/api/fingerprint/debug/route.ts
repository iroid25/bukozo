import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { fingerprintTemplatePreview, normalizeFingerprintTemplate } from "@/lib/fingerprint";
import { loadFingerprintMemberRow } from "@/lib/fingerprint-db";

const isProduction = process.env.NODE_ENV === "production";

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();

    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { memberId } = await request.json().catch(() => ({}));
    console.log("[fingerprint:debug] request", { memberId });

    if (!memberId) {
      return NextResponse.json({ error: "memberId is required" }, { status: 400 });
    }

    const member = await loadFingerprintMemberRow(memberId);

    if (!member) {
      console.warn("[fingerprint:debug] member not found", { memberId });
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const template = normalizeFingerprintTemplate(member.fingerprintTemplate);
    console.log("[fingerprint:debug] member loaded", {
      memberId: member.id,
      memberNumber: member.memberNumber,
      templateLength: template.length,
      templatePreview: fingerprintTemplatePreview(template),
      quality: member.fingerprintQuality,
      enrolledAt: member.fingerprintEnrolledAt,
    });

    return NextResponse.json({
      success: true,
      data: {
        memberId: member.id,
        memberNumber: member.memberNumber,
        memberName: member.memberName ?? null,
        email: member.email ?? null,
        createdAt: member.createdAt,
        updatedAt: member.updatedAt,
        hasTemplate: Boolean(template),
        templateLength: template.length,
        templatePreview: fingerprintTemplatePreview(template),
        // Rk1SACA = FMR\0 header = ANSI 378; Rk1S but different = ISO 19794-2; other = native/unknown
        isISOFormat: template.startsWith("Rk1S"),
        templateFormat: template.startsWith("Rk1SACA")
          ? "ANSI-378"
          : template.startsWith("Rk1S")
            ? "ISO-19794-2"
            : template
              ? "native/unknown"
              : "none",
        fingerprintQuality: member.fingerprintQuality,
        fingerprintEnrolledAt: member.fingerprintEnrolledAt,
        fingerprintUpdatedAt: member.fingerprintUpdatedAt ?? null,
        storedTemplate: isProduction ? null : template,
      },
    });
  } catch (error) {
    console.error("Error loading fingerprint debug info:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to load fingerprint debug info",
      },
      { status: 500 },
    );
  }
}
