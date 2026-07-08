
import React from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import Sidebar from "./components/Sidebar";
import Navbar from "./components/Navbar";
import MonthlyChargeAutoRunner from "./components/MonthlyChargeAutoRunner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { redirect } from "next/navigation";
import { getAuthenticatedRedirectPath } from "@/lib/auth-redirect";

// Force dynamic rendering for all dashboard routes
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  // Fetch member data to check for NIN
    // Safety check for session user id
    if (!session?.user?.id) {
       console.error("❌ Session user ID is missing in DashboardLayout");
       redirect("/login");
    }

    try {
      // For MEMBER role, enforce profile completion using fresh DB data,
      // not potentially stale JWT/session fields after profile updates.
      if (session.user.role === "MEMBER") {
        const memberTarget = await getAuthenticatedRedirectPath({
          userId: session.user.id,
          role: session.user.role,
          email: session.user.email,
          phone: session.user.phone,
          preferredPath: "/dashboard",
        });

        if (memberTarget !== "/dashboard") {
          redirect(memberTarget);
        }
      }

    } catch (error) {
      // If the error is a redirect, rethrow it so Next.js handles it
      if ((error as any).digest?.startsWith('NEXT_REDIRECT')) {
        throw error;
      }
      
      console.error("🔥 Dashboard Layout Error:", error);
      // Let the global error boundary handle other types of crashes
    }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-900">
      <MonthlyChargeAutoRunner role={session.user.role} />
      <Sidebar
        role={session.user.role}
        user={{
          name: session.user.name || undefined,
          image: session.user.image || undefined,
          email: session.user.email || undefined,
        }}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Navbar session={session as any} />
        <main className="flex-1 overflow-hidden p-4 md:p-6">
          <ScrollArea className="h-full rounded-xl bg-white shadow-sm ring-1 ring-slate-900/5 dark:bg-slate-950 dark:ring-slate-50/5/10">
            {children}
          </ScrollArea>
        </main>
      </div>
    </div>
  );
}
