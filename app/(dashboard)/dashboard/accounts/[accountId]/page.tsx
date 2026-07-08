// app/dashboard/accounts/[accountId]/page.tsx
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import AccountDetailsSkeleton from "../components/AccountDetailsLoadingSkeleton";
import AccountDetails from "../components/AccountDetails";

interface PageProps {
  params: Promise<{
    accountId: string;
  }>;
}

async function AccountDetailsData({ accountId }: { accountId: string }) {
  try {
    const headerList = await headers();
    const protocol = headerList.get("x-forwarded-proto") || "http";
    const host = headerList.get("x-forwarded-host") || headerList.get("host");
    const baseUrl = host ? `${protocol}://${host}` : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const response = await fetch(`${baseUrl}/api/v1/accounts/${encodeURIComponent(accountId)}/overview`, {
      cache: "no-store",
      headers: {
        cookie: headerList.get("cookie") || "",
      },
    });
    const json = await response.json();

    if (!response.ok) {
      return notFound();
    }

    const accountData = json?.data?.account;
    const summary = json?.data?.summary;

    if (!accountData || !summary) {
      return notFound();
    }

    // Determine the owner - must be either member or institution
    let owner:
      | {
          type: "member";
          id: string;
          memberNumber: string;
          registrationDate: Date;
          user: {
            id: string;
            name: string;
            firstName: string;
            lastName: string;
            email: string | null;
            phone?: string | null;
            image?: string | null;
          };
        }
      | {
          type: "institution";
          id: string;
          institutionNumber: string;
          registrationDate: Date;
          institutionName: string;
          user: {
            id: string;
            name: string;
            firstName: string;
            lastName: string;
            email: string | null;
            phone?: string | null;
            image?: string | null;
          };
        };

    if (accountData.member) {
      owner = {
        type: "member" as const,
        id: accountData.member.id, // Include the member database ID
        memberNumber: accountData.member.memberNumber,
        registrationDate: accountData.member.registrationDate,
        user: {
          id: accountData.member.user.id,
          name: accountData.member.user.name,
          firstName: accountData.member.user.firstName,
          lastName: accountData.member.user.lastName,
          email: accountData.member.user.email,
          phone: accountData.member.user.phone,
          image: accountData.member.user.image,
        },
      };
    } else if (accountData.institution) {
      owner = {
        type: "institution" as const,
        id: accountData.institution.id, // Include the institution database ID
        institutionNumber: accountData.institution.institutionNumber,
        registrationDate: accountData.institution.registrationDate,
        institutionName: accountData.institution.institutionName,
        user: {
          id: accountData.institution.user.id,
          name: accountData.institution.user.name,
          firstName: accountData.institution.user.firstName,
          lastName: accountData.institution.user.lastName,
          email: accountData.institution.user.email,
          phone: accountData.institution.user.phone,
          image: accountData.institution.user.image,
        },
      };
    } else {
      // Account has neither member nor institution - invalid state
      return notFound();
    }

    // Transform the account data to include the owner property
    const account = {
      ...accountData,
      owner,
    };

    return <AccountDetails account={account} summary={summary} />;
  } catch (error) {
    console.error("Failed to load account details:", error);
    notFound();
  }
}

export default async function AccountDetailsPage({ params }: PageProps) {
  const { accountId } = await params;

  // Validate accountId format
  if (!accountId || typeof accountId !== "string") {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Suspense fallback={<AccountDetailsSkeleton />}>
        <AccountDetailsData accountId={accountId} />
      </Suspense>
    </div>
  );
}
