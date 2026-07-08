"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import IncomeRecordForm from "./IncomeRecordForm";

export default function NewIncomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    categories: [] as any[],
    branches: [] as any[],
    members: [] as any[],
    institutions: [] as any[],
    accounts: [] as any[],
    userId: "",
    userRole: "",
  });

  useEffect(() => {
    async function load() {
      try {
        const [catRes, branchRes, sessionRes, memberRes] = await Promise.all([
          fetch("/api/v1/income/categories"),
          fetch("/api/v1/income/branches"),
          fetch("/api/auth/session"),
          fetch("/api/v1/members?limit=200&status=ACTIVE"),
        ]);

        const [catJson, branchJson, sessionJson, memberJson] = await Promise.all([
          catRes.ok ? catRes.json() : { data: [] },
          branchRes.ok ? branchRes.json() : { data: [] },
          sessionRes.ok ? sessionRes.json() : null,
          memberRes.ok ? memberRes.json() : { data: [] },
        ]);

        setFormData({
          categories: catJson.data ?? [],
          branches: branchJson.data ?? [],
          members: (memberJson.data ?? []).map((m: any) => ({
            id: m.id,
            memberNumber: m.memberNumber,
            user: { name: m.user?.name ?? "", email: m.user?.email ?? "", phone: m.user?.phone ?? null },
          })),
          institutions: [],
          accounts: [],
          userId: sessionJson?.user?.id ?? "",
          userRole: sessionJson?.user?.role ?? "",
        });
      } catch (err) {
        console.error("Failed to load income form data:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <IncomeRecordForm
      isOpen={true}
      onClose={() => router.push("/dashboard/accounts/incomes")}
      categories={formData.categories}
      branches={formData.branches}
      members={formData.members}
      institutions={formData.institutions}
      accounts={formData.accounts}
      userId={formData.userId}
      userRole={formData.userRole}
    />
  );
}
