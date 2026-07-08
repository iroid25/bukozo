import { notFound } from "next/navigation";
import TellerEditClient from "./TellerEditClient";
import { serverFetch } from "@/lib/server-fetch";

async function getAgentData(userId: string) {
  try {
    const [userRes, branchesRes] = await Promise.all([
      serverFetch(`/api/v1/users/${userId}`),
      serverFetch("/api/v1/branches"),
    ]);

    if (!userRes.ok) return null;

    const { data: user } = await userRes.json();
    const branchesJson = branchesRes.ok ? await branchesRes.json() : { data: [] };
    const branches = branchesJson.data ?? [];

    if (!user) return null;
    return { user, branches };
  } catch (error) {
    console.error("Error fetching agent data:", error);
    return null;
  }
}

export default async function AgentEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getAgentData(id);

  if (!data) {
    notFound();
  }

  return <TellerEditClient data={data} />;
}
