"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { notFound } from "next/navigation";
import InstitutionEditForm from "./components/InstitutionEditForm";

export default function InstitutionEditPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const router = useRouter();
  const [institution, setInstitution] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const currentUser = session?.user as any;
    const canEdit = currentUser?.role === "ADMIN" || currentUser?.role === "BRANCHMANAGER" || currentUser?.role === "ACCOUNTANT";
    if (session && !canEdit) {
      router.push("/dashboard/institutions");
      return;
    }
    Promise.all([
      fetch(`/api/v1/institutions/${id}`).then((r) => r.json()),
      fetch("/api/v1/branches").then((r) => r.json()),
    ]).then(([instJson, branchJson]) => {
      setInstitution(instJson.data || null);
      setBranches(branchJson.data || []);
      setLoading(false);
    });
  }, [id, session, router]);

  if (loading) return <div className="p-8 text-center text-slate-500">Loading...</div>;
  if (!institution) return notFound();

  return (
    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
      <InstitutionEditForm
        institution={institution}
        branches={branches}
        currentUser={session?.user as any}
      />
    </div>
  );
}
