"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import UserCreateForm from "@/app/(dashboard)/dashboard/users/components/UserCreateForm";
import type { UserCreateDTO } from "@/types/user";

type BranchOption = {
  id: string;
  name: string;
  location: string;
  contactPerson?: string | null;
  contactPhone?: string | null;
  email?: string | null;
};

type MemberWithUser = {
  id: string;
  userId: string;
  memberNumber: string;
  registrationDate?: string | Date | null;
  gender?: string | null;
  nin?: string | null;
  fingerprintTemplate: string | null;
  district?: string | null;
  village?: string | null;
  parish?: string | null;
  subCounty?: string | null;
  constituency?: string | null;
  postalAddress?: string | null;
  nokName?: string | null;
  nokRelationship?: string | null;
  nokPhone?: string | null;
  user: {
    firstName?: string | null;
    lastName?: string | null;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    dateOfBirth?: string | Date | null;
    nationalId?: string | null;
    jobTitle?: string | null;
    areaOfOperation?: string | null;
    address?: string | null;
    image?: string | null;
    role?: string | null;
    branchId?: string | null;
  };
};

function buildInitialData(member: MemberWithUser): Partial<UserCreateDTO> {
  const fallbackNames = (member.user.name || "").trim().split(/\s+/);
  const firstName =
    member.user.firstName || fallbackNames[0] || "Member";
  const lastName =
    member.user.lastName || fallbackNames.slice(1).join(" ") || "Member";

  return {
    firstName,
    lastName,
    name: member.user.name || `${firstName} ${lastName}`.trim(),
    email: member.user.email || "",
    phone: member.user.phone || null,
    dateOfBirth: member.user.dateOfBirth || null,
    registrationDate: member.registrationDate || null,
    gender: member.gender || null,
    nationalId: member.nin || member.user.nationalId || null,
    idCard: member.nin || member.user.nationalId || null,
    jobTitle: member.user.jobTitle || null,
    areaOfOperation: member.user.areaOfOperation || null,
    address: member.user.address || null,
    image: member.user.image || null,
    role: "MEMBER",
    branchId: member.user.branchId || undefined,
    fingerprintTemplate: member.fingerprintTemplate || undefined,
    district: member.district || "Kasese",
    village: member.village || null,
    parish: member.parish || null,
    subCounty: member.subCounty || null,
    constituency: member.constituency || null,
    postalAddress: member.postalAddress || null,
    nokName: member.nokName || null,
    nokRelationship: member.nokRelationship || null,
    nokPhone: member.nokPhone || null,
  };
}

export default function MemberUpdateClient({
  member,
  branches,
  hasFingerprint,
}: {
  member: MemberWithUser;
  branches: BranchOption[];
  hasFingerprint: boolean;
}) {
  const router = useRouter();
  const initialData = buildInitialData(member);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Update Member
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {hasFingerprint
              ? "This member already has a fingerprint enrolled. You can update their details or capture a new fingerprint."
              : "This member has no fingerprint enrolled yet. Capture one first before saving changes."}
          </p>
        </div>
        <Badge variant={hasFingerprint ? "default" : "secondary"}>
          {hasFingerprint ? "Fingerprint enrolled" : "Fingerprint required"}
        </Badge>
      </div>

      <UserCreateForm
        initialData={initialData}
        editingId={member.userId}
        isOpen={true}
        onClose={() => router.push("/dashboard/users/members")}
        role="MEMBER"
        branches={branches}
      />
    </div>
  );
}
