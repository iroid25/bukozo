"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BulkMigration } from "../components/BulkMigration";
import LoanMigrationClient from "../components/LoanMigrationClient";

/**
 * Migration page refactored to be fully client-side and API-driven.
 * This removes redundant server-side Prisma fetches.
 */
export default function MigrateLoanPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/loans">
            <Button variant="outline" size="icon">
                <ArrowLeft className="h-4 w-4" />
            </Button>
        </Link>
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Loan Migration</h1>
            <p className="text-muted-foreground">Import existing legacy loans into the system with complete breakdown.</p>
        </div>
      </div>

      <Tabs defaultValue="manual" className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
           <TabsTrigger value="manual">Manual Entry</TabsTrigger>
           <TabsTrigger value="bulk">Bulk Import (Excel)</TabsTrigger>
        </TabsList>
        
        <TabsContent value="manual" className="mt-6">
          <LoanMigrationClient />
        </TabsContent>

        <TabsContent value="bulk" className="mt-6">
           {/* BulkMigration now fetches its own data via props-less initialization if we update it */}
           <BulkMigrationWrapper />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BulkMigrationWrapper() {
    // We will update BulkMigration.tsx to handle empty props or provide a wrapper here
    // For now, let's keep it simple and just update BulkMigration.tsx to be self-sufficient if possible
    // Or we can fetch here and pass down.
    
    // Actually, I'll update BulkMigration.tsx to fetch its own data from the same APIs LoanMigrationForm uses
    return <BulkMigration members={[]} products={[]} officers={[]} />;
}
