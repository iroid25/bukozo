import { MemberApprovalStatus, type Member } from "@prisma/client";
import { db } from "@/prisma/db";

export type MemberTransactEligibilityResult =
  | {
      eligible: true;
      member: Pick<
        Member,
        "id" | "approvalStatus" | "createdAt" | "updatedAt" | "userId"
      >;
    }
  | {
      eligible: false;
      reason: string;
    };

export async function getMemberTransactEligibility(
  memberId: string,
): Promise<MemberTransactEligibilityResult> {
  const member = await db.member.findUnique({
    where: { id: memberId },
    select: {
      id: true,
      userId: true,
      approvalStatus: true,
      fingerprintTemplate: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!member) {
    return {
      eligible: false,
      reason: "Member not found",
    };
  }

  const hasFingerprintEnrollment = Boolean(member.fingerprintTemplate?.trim());
  const isApprovedByStatus =
    member.approvalStatus === MemberApprovalStatus.APPROVED;

  if (!isApprovedByStatus && !hasFingerprintEnrollment) {
    return {
      eligible: false,
      reason:
        "Member is not approved yet. Please enroll a fingerprint first.",
    };
  }

  const hasProfileUpdate =
    member.updatedAt.getTime() > member.createdAt.getTime();

  if (!hasProfileUpdate && !hasFingerprintEnrollment) {
    return {
      eligible: false,
      reason: "Member profile must be updated before transacting.",
    };
  }

  return {
    eligible: true,
    member,
  };
}

export async function assertMemberCanTransact(memberId: string): Promise<void> {
  const eligibility = await getMemberTransactEligibility(memberId);
  if (!eligibility.eligible) {
    throw new Error(eligibility.reason);
  }
}
