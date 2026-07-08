// app/dashboard/deposits/totaldeposits/page.tsx
import { Suspense } from "react";
import { TableLoading } from "@/components/ui/data-table";
import { getAuthUser } from "@/config/useAuth";
import DepositListing from "../components/DepositListing";
import { headers, cookies } from "next/headers";

async function TotalDepositListingWithData() {
  // Get protocol and host for absolute URL in server component
  const headersList = await headers();
  const protocol = headersList.get("x-forwarded-proto") || "http";
  const host = headersList.get("host");
  const baseUrl = `${protocol}://${host}`;

  const user = await getAuthUser();
  if (!user) {
    throw new Error("Unauthorized");
  }

  const cookieStore = await cookies();
  const cookieString = cookieStore.toString();

  try {
    const [depositsRes, statsRes] = await Promise.all([
      fetch(`${baseUrl}/api/v1/deposits`, { 
        cache: "no-store",
        headers: { Cookie: cookieString }
      }),
      fetch(`${baseUrl}/api/v1/deposits/stats`, { 
        cache: "no-store",
        headers: { Cookie: cookieString }
      }),
    ]);

    if (!depositsRes.ok || !statsRes.ok) {
        throw new Error("Failed to fetch deposits data");
    }

    const allDeposits = await depositsRes.json();
    const statistics = await statsRes.json();

    return (
        <DepositListing
        title={`All Deposits (${allDeposits.length})`}
        subtitle="Complete history of all deposit transactions"
        deposits={allDeposits || []}
        statistics={statistics}
        userRole={user.role}
        currentUserId={user.id}
        />
    );
  } catch (error: any) {
    console.error("Total Deposits Error:", error);
    return (
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
            <h2 className="text-xl font-semibold text-red-600">Failed to Load Deposits</h2>
            <p className="text-gray-500">{error.message || "An unexpected error occurred."}</p>
        </div>
    );
  }
}

export default function TotalDepositsPage() {
  return (
    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
      <Suspense fallback={<TableLoading />}>
        <TotalDepositListingWithData />
      </Suspense>
    </div>
  );
}
