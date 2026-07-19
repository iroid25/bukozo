import { Suspense } from "react";
import { TableLoading } from "@/components/ui/data-table";
import { getAuthUser } from "@/config/useAuth";
import DepositListing from "../components/DepositListing";
import { headers, cookies } from "next/headers";

async function TodaysDepositListingWithData() {
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
    const depositsList = allDeposits?.data || allDeposits || [];

    // Filter deposits for today
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));

    const todaysDeposits = depositsList.filter((deposit: any) => {
        const depositDate = new Date(deposit.depositDate);
        return depositDate >= startOfDay;
    });

    return (
        <DepositListing
        title={`Today's Deposits (${todaysDeposits.length})`}
        subtitle={`All deposits made today - ${new Date().toLocaleDateString(
            "en-UG",
            {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            }
        )}`}
        deposits={todaysDeposits || []}
        statistics={statistics}
        userRole={user.role}
        currentUserId={user.id}
        />
    );
  } catch (error: any) {
    console.error("Today's Deposits Error:", error);
    return (
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
            <h2 className="text-xl font-semibold text-red-600">Failed to Load Today's Deposits</h2>
            <p className="text-gray-500">{error.message || "An unexpected error occurred."}</p>
        </div>
    );
  }
}

export default function TodaysDepositsPage() {
  return (
    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
      <Suspense fallback={<TableLoading />}>
        <TodaysDepositListingWithData />
      </Suspense>
    </div>
  );
}
