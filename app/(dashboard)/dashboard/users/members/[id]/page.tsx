import { redirect } from "next/navigation";
import { serverFetch } from "@/lib/server-fetch";

export default async function page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const res = await serverFetch(`/api/v1/members/${id}`);
  if (!res.ok) {
    redirect("/dashboard/users/members");
  }

  redirect(`/dashboard/users/members/${id}/edit`);
}
