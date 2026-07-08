import StatementDetailPageClient from "./StatementDetailPageClient";

interface StatementDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function StatementDetailPage({
  params,
}: StatementDetailPageProps) {
  const { id } = await params;

  return (
    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
      <StatementDetailPageClient id={id} />
    </div>
  );
}
