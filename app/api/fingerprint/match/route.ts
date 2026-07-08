import { NextRequest, NextResponse } from "next/server";
import { normalizeFingerprintTemplate } from "@/lib/fingerprint";
import { db } from "@/prisma/db";

const BRIDGE              = "http://127.0.0.1:8001";
const MATCH_THRESHOLD     = 40;
const UPDATE_QUALITY_FLOOR = 60;
const SG400_SIZE           = 400;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { template1, template2, memberId, liveQuality } = body || {};

    const t1 = normalizeFingerprintTemplate(template1);
    const t2 = normalizeFingerprintTemplate(template2);

    if (!t1 || !t2) {
      return NextResponse.json(
        { error: "template1 and template2 are required." },
        { status: 400 },
      );
    }

    // Guard: both templates must be 400-byte SG400 native format
    const t1Bytes = Buffer.from(t1, "base64").length;
    const t2Bytes = Buffer.from(t2, "base64").length;

    if (t1Bytes !== SG400_SIZE || t2Bytes !== SG400_SIZE) {
      console.warn("[fingerprint:match] wrong template size t1=%d t2=%d", t1Bytes, t2Bytes);
      return NextResponse.json({
        ErrorCode: 103,
        MatchingScore: null,
        error: `Member needs re-enrollment. Template size: stored=${t1Bytes}B live=${t2Bytes}B (expected 400B SG400).`,
        needsReEnrollment: true,
      });
    }

    console.log("[fingerprint:match] calling bridge t1=%dB t2=%dB", t1Bytes, t2Bytes);

    let result: { errorCode: number; score: number; matched: boolean; error?: string };
    try {
      const res = await fetch(`${BRIDGE}/match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template1: t1, template2: t2 }),
        signal: AbortSignal.timeout(12000),
      });
      result = await res.json();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[fingerprint:match] bridge unreachable:", msg);
      return NextResponse.json(
        { error: "Fingerprint matching service is not running. Start fingerprint-bridge/server.js." },
        { status: 503 },
      );
    }

    console.log("[fingerprint:match] errorCode=%d score=%d matched=%s",
      result.errorCode, result.score, result.matched);

    if (result.errorCode !== 0) {
      return NextResponse.json(
        {
          ErrorCode: result.errorCode,
          MatchingScore: result.score ?? 0,
          error: "Fingerprint match failed. Please scan again or re-enroll.",
          bridgeError: result.error,
        },
        { status: 422 },
      );
    }

    // Adaptive template update on confirmed match with good quality
    if (result.matched && memberId && (liveQuality ?? 0) >= UPDATE_QUALITY_FLOOR) {
      db.member
        .update({
          where: { id: memberId },
          data: {
            fingerprintTemplate:  t2,
            fingerprintQuality:   liveQuality,
            fingerprintUpdatedAt: new Date(),
          },
        })
        .catch((err: unknown) =>
          console.warn("[fingerprint:match] adaptive update failed:", err),
        );
    }

    return NextResponse.json({
      ErrorCode:       0,
      MatchingScore:   result.score,
      matched:         result.matched,
      templateUpdated: result.matched,
    });
  } catch (error) {
    console.error("[fingerprint:match] unhandled error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Match endpoint error." },
      { status: 502 },
    );
  }
}
