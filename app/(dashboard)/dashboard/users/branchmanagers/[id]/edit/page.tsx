import { notFound } from "next/navigation";
import BranchManagerEditClient from "./BranchManagerEditClient";
import { serverFetch } from "@/lib/server-fetch";

async function getBranchManagerData(userId: string) {
  try {
    const [userRes, branchesRes] = await Promise.all([
      serverFetch(`/api/v1/users/${userId}`),
      serverFetch("/api/v1/branches"),
    ]);

    if (!userRes.ok) return null;

    const { data: user } = await userRes.json();
    const branchesJson = branchesRes.ok ? await branchesRes.json() : { data: [] };
    const branches = branchesJson.data ?? [];

    if (!user || user.role !== "BRANCHMANAGER") return null;
    return { user, branches };
  } catch (error) {
    console.error("Error fetching branch manager data:", error);
    return null;
  }
}

export default async function BranchManagerEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getBranchManagerData(id);

  if (!data) {
    notFound();
  }

  return <BranchManagerEditClient data={data} />;
}
