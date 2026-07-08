"use client";

import { useRouter } from "next/navigation";
import UserCreateForm from "@/app/(dashboard)/dashboard/users/components/UserCreateForm";

export default function CreateTellerClient({
  branches,
  branchId,
}: {
  branches: Array<{ id: string; name: string; location: string }>;
  branchId?: string;
}) {
  const router = useRouter();

  return (
    <UserCreateForm
      isOpen
      onClose={() => router.push("/dashboard/users/tellers")}
      role="TELLER"
      branchId={branchId}
      branches={branches}
    />
  );
}
