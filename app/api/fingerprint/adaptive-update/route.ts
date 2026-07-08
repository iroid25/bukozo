import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { normalizeFingerprintTemplate } from "@/lib/fingerprint";
import { db } from "@/prisma/db";

const SG400_SIZE = 400;

// Called by the client after a successful client-side bridge match (remote deployment
// where the Next.js server cannot reach localhost:8001 on the teller's machine).
// Only updates the template — does NOT re-verify the match.
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const allowedRoles = new Set([
      "ADMIN", "BRANCHMANAGER", "TELLER", "DATA_ENTRANT", "ACCOUNTANT", "AGENT", "LOANOFFICER",
    ]);
    if (!allowedRoles.has(String(user.role))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({})) as {
      memberId?: string;
      liveTemplate?: string;
      liveQuality?: number;
    };

    const { memberId, liveTemplate, liveQuality } = body;

    if (!memberId || !liveTemplate) {
      return NextResponse.json(
        { error: "memberId and liveTemplate are required." },
        { status: 400 },
      );
    }

    const clean = normalizeFingerprintTemplate(liveTemplate);
    if (Buffer.from(clean, "base64").length !== SG400_SIZE) {
      return NextResponse.json(
        { error: `Template must be ${SG400_SIZE} bytes (SG400 native format).` },
        { status: 400 },
      );
    }

    await db.member.update({
      where: { id: memberId },
      data: {
        fingerprintTemplate:  clean,
        fingerprintQuality:   typeof liveQuality === "number" ? liveQuality : undefined,
        fingerprintUpdatedAt: new Date(),
      },
    });

    console.log("[fingerprint:adaptive-update] updated template for member", memberId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[fingerprint:adaptive-update] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Adaptive update failed." },
      { status: 500 },
    );
  }
}
