"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function MainDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user) {
      router.push("/login");
      return;
    }
    const role = (session.user as any).role;
    switch (role) {
      case "ADMIN": router.push("/dashboard/pages/admin"); break;
      case "BRANCHMANAGER": router.push("/dashboard/pages/branch-manager"); break;
      case "TELLER": router.push("/dashboard/pages/teller"); break;
      case "AGENT": router.push("/dashboard/pages/agent"); break;
      case "LOANOFFICER": router.push("/dashboard/pages/loan-officer"); break;
      case "ACCOUNTANT": router.push("/dashboard/pages/accountant"); break;
      case "AUDITOR": router.push("/dashboard/pages/auditor"); break;
      case "MEMBER": router.push("/dashboard/pages/member"); break;
      case "INSTITUTION": router.push("/dashboard/pages/institution"); break;
      case "DATA_ENTRANT": router.push("/dashboard/pages/data-entrant"); break;
      default: break;
    }
  }, [session, status, router]);

  if (status === "loading" || session?.user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const user = session?.user as any;
  return (
    <main className="p-8 space-y-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome, {user?.name}</h1>
        <p className="text-red-600">Your role is not properly configured. Please contact system administrator.</p>
      </div>
    </main>
  );
}
