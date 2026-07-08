import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { getAuthUser } from "@/config/useAuth";
import { serverFetch } from "@/lib/server-fetch";
import { TableLoading } from "@/components/ui/data-table";
import TransactionDetailView from "../components/TransactionDetailView";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ action?: string }>;
}

async function TransactionDetailContent({ transactionId, action }: { transactionId: string; action?: string }) {
  const user = await getAuthUser();
  if (!user) redirect("/auth/login");

  const res = await serverFetch(`/api/v1/transactions/${transactionId}`);
  if (!res.ok) notFound();

  const json = await res.json();
  const transaction = json.data ?? json;

  if (!transaction) notFound();

  return (
    <TransactionDetailView
      transaction={transaction}
      currentUser={user as any}
      action={action}
    />
  );
}

export default async function TransactionDetailPage(props: PageProps) {
  const params = await props.params;
  const searchParams = props.searchParams ? await props.searchParams : {};
  return (
    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
      <Suspense fallback={<TableLoading />}>
        <TransactionDetailContent transactionId={params.id} action={searchParams.action} />
      </Suspense>
    </div>
  );
}
