import { getAuthUser } from "@/config/useAuth";

export default async function Home() {
  const user = await getAuthUser();
  // const apiKeys = await getOrgApiKeys(user.orgId);
  return (
    <main className="container mx-auto py-8 px-4">
      {/* <ApiKeyManagement orgKeys={apiKeys} /> */}
    </main>
  );
}
