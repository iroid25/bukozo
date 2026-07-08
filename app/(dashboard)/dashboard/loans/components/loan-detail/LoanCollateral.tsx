"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loan } from "@/types/loan";
import { Shield, Users } from "lucide-react";

interface LoanCollateralProps {
  loanApplication: Loan["loanApplication"] & {
    collateralType?: string | null;
    collateralValue?: number | null;
    collateralDetails?: string | null;
    forcedSaleValue?: number | null;
    guarantors?: any;
    collateralOffered?: string | null;
  };
}

export default function LoanCollateral({ loanApplication }: LoanCollateralProps) {
  const formatCurrency = (amount: number) =>
    `USh ${amount.toLocaleString("en-UG", { minimumFractionDigits: 0 })}`;

  // Helper for Guarantors extraction
  const guarantorsData = Array.isArray(loanApplication.guarantors)
    ? loanApplication.guarantors
    : typeof loanApplication.guarantors === "string"
    ? JSON.parse(loanApplication.guarantors)
    : [];
    
  // Fallback for collateral type if not explicitly set but present in free text
  const primaryCollateral = loanApplication.collateralType || loanApplication.collateralOffered;

  return (
    <Card className="rounded-xl border-neutral-100 shadow-sm overflow-hidden bg-neutral-50/50">
      <CardHeader>
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <Shield className="h-5 w-5 text-amber-500" />
          Collateral & Guarantees
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {primaryCollateral ? (
          <div className="bg-white p-5 rounded-2xl border border-neutral-100 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                Primary Security
              </span>
              <div className="inline-flex items-center rounded-md border px-2 py-0 bg-amber-100 text-amber-700 border-transparent text-[8px] font-black uppercase">
                {primaryCollateral}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-neutral-500 uppercase tracking-tighter">
                  Value Assessment
                </span>
                <div className="text-xl font-black text-neutral-900">
                  {formatCurrency(loanApplication.collateralValue || 0)}
                </div>
              </div>
              {loanApplication.forcedSaleValue && (
                <div className="text-right space-y-0.5">
                  <span className="text-[8px] font-black text-rose-500 uppercase tracking-widest">
                    Forced Sale Value
                  </span>
                  <div className="text-sm font-bold text-rose-600">
                    {formatCurrency(loanApplication.forcedSaleValue)}
                  </div>
                </div>
              )}
            </div>
            <div className="pt-2">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                Description
              </span>
              <p className="text-xs font-medium text-neutral-600 italic leading-relaxed mt-1">
                {loanApplication.collateralDetails ||
                  "Detailed collateral specification not available."}
              </p>
            </div>
          </div>
        ) : (
          <div className="p-10 text-center space-y-3 opacity-60">
            <Shield className="h-10 w-10 text-neutral-300 mx-auto" />
            <p className="text-xs font-medium italic">
              No primary collateral recorded for this application.
            </p>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> Guarantors Ledger
            </span>
            <span className="text-[10px] font-black text-neutral-500">
              {guarantorsData.length} Selected
            </span>
          </div>
          <div className="space-y-2">
            {Array.isArray(guarantorsData) && guarantorsData.length > 0 ? (
              guarantorsData.map((g: any, i: number) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 bg-white rounded-xl border border-neutral-100 shadow-sm group hover:border-indigo-200 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-neutral-50 flex items-center justify-center font-black text-[10px] text-neutral-400 group-hover:bg-indigo-50 group-hover:text-indigo-600">
                      {g.name?.charAt(0) || "G"}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-neutral-800">
                        {g.name || "Unnamed Guarantor"}
                      </span>
                      <span className="text-[10px] text-muted-foreground italic">
                        {g.relationship || "Contact Witness"}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-bold text-neutral-400">
                        {g.phone || "No direct phone"}
                    </div>
                    <div className="text-[9px] text-neutral-300 font-mono">
                        {g.nin || ""}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-4 bg-white/40 rounded-xl border border-dashed text-center text-[10px] font-medium text-muted-foreground italic">
                No external guarantors verified for this portfolio instrument.
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
