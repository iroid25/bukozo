// // app/dashboard/loan-applications/[id]/page.tsx
// import { getLoanApplicationById } from "@/actions/loanApplications";
// import { Suspense } from "react";
// import { notFound } from "next/navigation";
// // import LoanApplicationDetail from "../components/LoanApplicationDetail";
// import { getAuthUser } from "@/config/useAuth";
// import LoanApplicationDetail from "../components/LoanApplicationDetail";

// interface Props {
//   params: Promise<{
//     id: string;
//   }>;
// }

// // Create an async component for data fetching
// async function LoanApplicationDetailWithData({
//   applicationId,
// }: {
//   applicationId: string;
// }) {
//   const [loanApplication, user] = await Promise.all([
//     getLoanApplicationById(applicationId),
//     getAuthUser(),
//   ]);

//   if (!loanApplication) {
//     notFound();
//   }

//   return (
//     <LoanApplicationDetail
//       loanApplication={loanApplication}
//       userRole={user?.role ?? "TELLER"}
//       currentUserId={user?.id ?? ""}
//     />
//   );
// }

// export default async function LoanApplicationDetailPage({ params }: Props) {
//   const { id } = await params;
//   return (
//     <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
//       <Suspense fallback={<div>Loading loan application details...</div>}>
//         <LoanApplicationDetailWithData applicationId={id} />
//       </Suspense>
//     </div>
//   );
// }


// app/dashboard/loan-applications/[id]/page.tsx
import { Suspense } from "react";
import { notFound } from "next/navigation";
import LoanApplicationDetail from "../components/LoanApplicationDetail";
import { getAuthUser } from "@/config/useAuth";

async function getApiData(endpoint: string) {
  const nextAuthUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const baseUrl = nextAuthUrl.replace(/\/$/, "");
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = `${baseUrl}${cleanEndpoint}`;
  
  const response = await fetch(url, {
    headers: {
      cookie: (await (await import("next/headers")).cookies()).toString(),
    },
  });
  
  if (!response.ok) {
    console.error(`Error fetching ${endpoint}:`, response.statusText);
    return null;
  }
  
  return response.json();
}

interface Props {
  params: Promise<{
    id: string;
  }>;
}

// Create an async component for data fetching
async function LoanApplicationDetailWithData({
  applicationId,
}: {
  applicationId: string;
}) {
  const [loanApplication, user, tellersResponse] = await Promise.all([
    getApiData(`/api/v1/loans/applications/${applicationId}`),
    getAuthUser(),
    getApiData("/api/v1/users?role=TELLER,AGENT"),
  ]);

  if (!loanApplication) {
    notFound();
  }

  const tellersData = tellersResponse?.data || [];
  const tellers = tellersData.map((item: any) => ({
    label: `${item.name} - ${item.branch?.name || "No Branch"}`,
    value: item.id,
    branchId: item.branchId,
  }));

  return (
    <LoanApplicationDetail
      tellers={tellers}
      loanApplication={loanApplication}
      userRole={user?.role ?? "TELLER"}
      currentUserId={user?.id ?? ""}
    />
  );
}

export default async function LoanApplicationDetailPage({ params }: Props) {
  const { id } = await params;
  return (
    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
      <Suspense fallback={<div>Loading loan application details...</div>}>
        <LoanApplicationDetailWithData applicationId={id} />
      </Suspense>
    </div>
  );
}
