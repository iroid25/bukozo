"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import MemberDepositListing from "../../components/MemberDepositListing";

export default function MemberDepositDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const router = useRouter();
  const [deposit, setDeposit] = useState<any>(null);
  const [memberName, setMemberName] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/v1/deposits/${id}`);
      if (!res.ok) { setLoading(false); return; }
      const json = await res.json();
      setDeposit(json.data);
      setMemberName(json.data?.member?.user?.name || "");
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) return <div className="flex items-center justify-center min-h-[200px]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;
  if (!deposit) return <div className="p-8 text-center text-gray-500">Deposit not found.</div>;

  const statistics = {
    today: { amount: deposit.amount, count: 1 },
    thisMonth: { amount: deposit.amount, count: 1 },
    total: { amount: deposit.amount, count: 1 },
  };

  return (
    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
      <MemberDepositListing
        deposits={[deposit]}
        statistics={statistics}
        memberName={memberName}
      />
    </div>
  );
}
