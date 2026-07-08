"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import CreateTellerClient from "./CreateTellerClient";

export default function NewTellerPage() {
  const { data: session } = useSession();
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/branches")
      .then((r) => r.json())
      .then((json) => {
        setBranches(json.data || []);
        setLoading(false);
      });
  }, []);

  const currentUser = session?.user as any;

  if (loading) return <div className="p-8 text-center text-slate-500">Loading...</div>;

  return (
    <div className="container mx-auto space-y-6 px-6 py-8">
      <div className="space-y-2">
        <p className="text-sm uppercase tracking-[0.25em] text-muted-foreground">
          User Management
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight">Create Teller</h1>
        <p className="text-muted-foreground">
          Register a teller and assign the correct branch before they start working.
        </p>
      </div>
      <CreateTellerClient branches={branches} branchId={currentUser?.branchId ?? ""} />
    </div>
  );
}
