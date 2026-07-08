import { notFound } from "next/navigation";
import LoanOfficerEditClient from "./LoanOfficerEditClient";
import { serverFetch } from "@/lib/server-fetch";

async function getLoanOfficerData(userId: string) {
  try {
    const [userRes, branchesRes] = await Promise.all([
      serverFetch(`/api/v1/users/${userId}`),
      serverFetch("/api/v1/branches"),
    ]);

    if (!userRes.ok) return null;

    const { data: user } = await userRes.json();
    const branchesJson = branchesRes.ok ? await branchesRes.json() : { data: [] };
    const branches = branchesJson.data ?? [];

    if (!user || user.role !== "LOANOFFICER") return null;
    return { user, branches };
  } catch (error) {
    console.error("Error fetching loan officer data:", error);
    return null;
  }
}

export default async function LoanOfficerEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getLoanOfficerData(id);

  if (!data) {
    notFound();
  }

  return <LoanOfficerEditClient data={data} />;
}
