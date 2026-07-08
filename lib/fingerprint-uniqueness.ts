import { db } from "@/prisma/db";
import {
  fingerprintTemplatePreview,
  isLikelyFingerprintTemplate,
  normalizeFingerprintTemplate,
  matchTemplatesViaBridge,
} from "@/lib/fingerprint";

const MATCH_THRESHOLD = 40;
const SG400_SIZE      = 400;

type MemberFingerprintRecord = {
  id: string;
  memberNumber: string;
  fingerprintTemplate: string | null;
  user: { name: string | null } | null;
};

type FingerprintQueryClient = {
  member: { findMany: (args: any) => Promise<any[]> };
};

/**
 * Returns a numeric score (0–200) or null if templates are invalid/incompatible format.
 * Throws if the bridge is unreachable — callers must treat that as a hard failure,
 * not a "no conflict found" result.
 */
async function getMatchingScore(
  template1: string,
  template2: string,
): Promise<number | null> {
  const t1 = normalizeFingerprintTemplate(template1);
  const t2 = normalizeFingerprintTemplate(template2);

  if (!isLikelyFingerprintTemplate(t1) || !isLikelyFingerprintTemplate(t2)) {
    return null; // invalid template — skip silently
  }

  // Only SG400 (400-byte) templates can be matched via bridge
  const t1Bytes = Buffer.from(t1, "base64").length;
  const t2Bytes = Buffer.from(t2, "base64").length;
  if (t1Bytes !== SG400_SIZE || t2Bytes !== SG400_SIZE) {
    return null; // not SG400 format — skip silently
  }

  // Bridge errors bubble up as exceptions — do NOT catch here.
  // A bridge that is down must block enrollment, not silently pass it.
  const result = await matchTemplatesViaBridge(t1, t2);
  if (result.errorCode !== 0) {
    return null; // DLL-level mismatch/error — skip this template
  }
  return result.score;
}

export async function findFingerprintConflict(
  candidateTemplate: string,
  options?: {
    excludeMemberId?: string;
    client?: FingerprintQueryClient;
  },
): Promise<(MemberFingerprintRecord & { matchingScore: number }) | null> {
  const client        = options?.client ?? db;
  const excludeMemberId = options?.excludeMemberId;
  const clean         = normalizeFingerprintTemplate(candidateTemplate);

  if (!isLikelyFingerprintTemplate(clean)) return null;

  const members = (await client.member.findMany({
    where: {
      fingerprintTemplate: { not: null },
      ...(excludeMemberId ? { NOT: { id: excludeMemberId } } : {}),
    },
    select: {
      id: true,
      memberNumber: true,
      fingerprintTemplate: true,
      user: { select: { name: true } },
    },
  })) as MemberFingerprintRecord[];

  for (const member of members) {
    if (!member.fingerprintTemplate) continue;
    const score = await getMatchingScore(member.fingerprintTemplate, clean);
    if (score !== null && score >= MATCH_THRESHOLD) {
      return { ...member, matchingScore: score } as MemberFingerprintRecord & { matchingScore: number };
    }
  }

  return null;
}
