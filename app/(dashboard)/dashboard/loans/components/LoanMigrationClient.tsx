"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Upload, FileSpreadsheet } from "lucide-react";
import LoanMigrationForm from "./LoanMigrationForm";

export default function LoanMigrationClient() {
  const [isFormOpen, setIsFormOpen] = useState(false);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Migrate Single Loan</CardTitle>
          <CardDescription>
            Manually import a legacy loan with complete breakdown of outstanding balance, period tracking, and guarantor selection.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="p-6 rounded-full bg-primary/10">
              <Upload className="h-12 w-12 text-primary" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold">Import Legacy Loan</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Click the button below to open the comprehensive loan migration form with:
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 max-w-md">
                <li>✓ Outstanding balance breakdown (Principle + Interest + Penalties)</li>
                <li>✓ Original and current period specification</li>
                <li>✓ Searchable guarantor selection from members</li>
                <li>✓ Number formatting with comma separators</li>
                <li>✓ Collateral management</li>
              </ul>
            </div>
            <Button 
              onClick={() => setIsFormOpen(true)}
              size="lg"
              className="mt-4"
            >
              <Upload className="h-4 w-4 mr-2" />
              Open Migration Form
            </Button>
          </div>
        </CardContent>
      </Card>

      <LoanMigrationForm 
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
      />
    </div>
  );
}
