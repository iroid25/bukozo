"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { notFound } from "next/navigation";
import BranchEditForm from "./component/BranchEditForm";

export default function BranchEditPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const router = useRouter();
  const [branch, setBranch] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const currentUser = session?.user as any;
    if (session && currentUser?.role !== "ADMIN") {
      router.push("/dashboard/branches");
      return;
    }
    fetch(`/api/v1/branches/${id}`)
      .then((r) => r.json())
      .then((json) => {
        setBranch(json.data || null);
        setLoading(false);
      });
  }, [id, session, router]);

  if (loading) return <div className="p-8 text-center text-slate-500">Loading...</div>;
  if (!branch) return notFound();

  return (
    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
      <BranchEditForm branch={branch} />
    </div>
  );
}
