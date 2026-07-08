// ============================================================================
// app/dashboard/accountant/layout.tsx (FIXED - Type Safe)
// ============================================================================
import { redirect } from "next/navigation";
import { getAuthUser } from "@/config/useAuth";

import { UserRole } from "@prisma/client"; // Import the actual enum from Prisma
import AccountantReconciliationPopup from "./distribution/reconciliations/components/AccountantReconciliationPopup";

export default async function AccountantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthUser();

  // ✅ Redirect to login if not authenticated
  if (!user) {
    redirect("/login");
  }

  // ✅ Type-safe role check using Prisma enum
  const userRole = user.role as UserRole;

  // ✅ Redirect TELLER and AGENT to their float page
  //   if (userRole === UserRole.TELLER || userRole === UserRole.AGENT) {
  //     redirect("/dashboard/floats/my-float");
  //   }

  //   // ✅ Block unauthorized roles (allow ACCOUNTANT, ADMIN, BRANCHMANAGER)
  //   if (
  //     userRole !== UserRole.ACCOUNTANT &&
  //     userRole !== UserRole.ADMIN &&
  //     userRole !== UserRole.BRANCHMANAGER
  //   ) {
  //     redirect("/dashboard");
  //   }

  return (
    <div className="relative">
      {children}

      {/* ✅ Popup only for ACCOUNTANT and ADMIN */}
      {(userRole === UserRole.ACCOUNTANT || userRole === UserRole.ADMIN) && (
        <AccountantReconciliationPopup
          accountantId={user.id}
          branchId={user.branchId || undefined}
        />
      )}
    </div>
  );
}
