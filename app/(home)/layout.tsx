import SiteHeader from "@/components/frontend/site-header";
import { authOptions } from "@/config/auth";
import { Bricolage_Grotesque } from "next/font/google";
import { getServerSession } from "next-auth";
import React, { ReactNode } from "react";
import { cn } from "@/lib/utils";
import Footer from "@/components/frontend/currentUiComponents/components/footer";
const manrope = Bricolage_Grotesque({ subsets: ["latin"], display: "swap" });
export default async function HomeLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getServerSession(authOptions);
  return (
    <div className={cn("min-h-screen bg-white", manrope.className)}>
      {/* <PromoBanner /> */}
      <SiteHeader session={session} />
      {children}
      <Footer />
    </div>
  );
}
