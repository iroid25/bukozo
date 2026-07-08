"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import InstitutionDetailsView from "./components/InstitutionDetailsView";
import { Skeleton } from "@/components/ui/skeleton";

function InstitutionDetailsSkeleton() {
  return (
    <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-6">
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-32" />)}
      </div>
    </div>
  );
}

export default function InstitutionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const [institution, setInstitution] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/v1/institutions/${id}`)
      .then((r) => r.json())
      .then((json) => {
        setInstitution(json.data);
        setLoading(false);
      });
  }, [id]);

  if (loading) return <InstitutionDetailsSkeleton />;
  if (!institution) return <div className="p-8 text-center text-gray-500">Institution not found.</div>;

  return (
    <div className="flex h-full flex-1 flex-col">
      <InstitutionDetailsView institution={institution} currentUser={session?.user as any} />
    </div>
  );
}
