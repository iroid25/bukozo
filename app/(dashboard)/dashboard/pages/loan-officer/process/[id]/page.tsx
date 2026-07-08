"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { DollarSign, User, Calculator, Send } from "lucide-react";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const [app, setApp] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadApp = async () => {
    const res = await fetch(`/api/v1/loans/applications/${id}`);
    const json = await res.json();
    setApp(json.data || json);
    setLoading(false);
  };

  useEffect(() => { loadApp(); }, [id]);

  async function markAnalysis() {
    await fetch(`/api/v1/loans/applications/${id}/analyze`, { method: "POST" });
    loadApp();
  }

  async function forward() {
    await fetch(`/api/v1/loans/applications/${id}/forward`, { method: "POST" });
    loadApp();
  }

  if (loading) return <div className="p-4 text-slate-500">Loading...</div>;
  if (!app) return <div className="p-4 text-red-600">Application not found</div>;

  const guarantors = Array.isArray(app.guarantors) ? app.guarantors as any[] : [];

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Officer Process – {app.id}</h1>
        <div className="flex gap-2">
          {app.stage === "SUBMITTED" && (
            <Button variant="outline" onClick={markAnalysis}>
              <Calculator className="h-4 w-4 mr-1" /> Mark In Analysis
            </Button>
          )}
          {app.stage === "IN_ANALYSIS" && (
            <Button onClick={forward}>
              <Send className="h-4 w-4 mr-1" /> Forward to Manager
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Application Summary</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded border p-3">
                <div className="text-sm text-gray-600">Member</div>
                <div className="font-medium flex items-center gap-2">
                  <User className="h-4 w-4" /> {app.member?.user?.name} (#{app.memberId?.slice(0, 6)}...)
                </div>
              </div>
              <div className="rounded border p-3">
                <div className="text-sm text-gray-600">Product</div>
                <div className="font-medium">{app.loanProduct?.name}</div>
              </div>
              <div className="rounded border p-3">
                <div className="text-sm text-gray-600">Amount</div>
                <div className="font-semibold text-green-700 flex items-center gap-2">
                  <DollarSign className="h-4 w-4" /> UGX {Math.round(app.amountApplied || 0).toLocaleString()}
                </div>
              </div>
              <div className="rounded border p-3">
                <div className="text-sm text-gray-600">Purpose</div>
                <div className="font-medium">{app.purpose || "-"}</div>
              </div>
            </div>

            <div className="rounded border p-3">
              <div className="text-sm text-gray-600 mb-1">Loan Details</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div>Repayment Period: <b>{app.repaymentPeriodMonths ?? Math.round((app.loanProduct?.repaymentPeriodDays || 30) / 30)} months</b></div>
                <div>Start Date: <b>{app.repaymentStartDate ? new Date(app.repaymentStartDate).toLocaleDateString() : "-"}</b></div>
                <div>Mode: <b>{app.modeOfRepayment || "-"}</b></div>
                <div>Collateral: <b>{app.collateralOffered || "-"}</b></div>
              </div>
            </div>

            <div className="rounded border p-3">
              <div className="text-sm text-gray-600 mb-1">Applicant Income</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div>Employer: <b>{app.employer || "-"}</b></div>
                <div>Status: <b>{app.employmentStatus || "-"}</b></div>
                <div>Gross: <b>{app.grossMonthlyIncome != null ? `UGX ${Math.round(app.grossMonthlyIncome).toLocaleString()}` : "-"}</b></div>
                <div>Net: <b>{app.netMonthlyIncome != null ? `UGX ${Math.round(app.netMonthlyIncome).toLocaleString()}` : "-"}</b></div>
              </div>
            </div>

            <div className="rounded border p-3">
              <div className="text-sm text-gray-600 mb-2">Guarantors</div>
              {guarantors.length === 0 ? (
                <div className="text-sm text-gray-500">None</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {guarantors.map((g: any, idx: number) => (
                    <div key={idx} className="p-3 rounded bg-purple-50 border">
                      <div className="font-medium mb-1">Guarantor {idx + 1}</div>
                      <div className="text-sm">Name: <b>{g?.fullName || "-"}</b></div>
                      <div className="text-sm">Membership: <b>{g?.membershipNumber || "-"}</b></div>
                      <div className="text-sm">Phone: <b>{g?.phone || "-"}</b></div>
                      <div className="text-sm">Relationship: <b>{g?.relationship || "-"}</b></div>
                      <div className="text-sm">Monthly Income: <b>{g?.monthlyIncome != null ? `UGX ${Math.round(g.monthlyIncome).toLocaleString()}` : "-"}</b></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Officer Analysis</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded border p-3 bg-gray-50">
              <div className="text-gray-600 mb-1">Appraisal Score</div>
              <div><b>{app.appraisalScore ?? "-"}</b></div>
            </div>
            <div className="rounded border p-3 bg-gray-50">
              <div className="text-gray-600 mb-1">Estimated DTI</div>
              <div><b>{app.debtToIncomeRatio != null ? `${app.debtToIncomeRatio.toFixed(1)}%` : "-"}</b></div>
            </div>
            <div className="rounded border p-3 bg-gray-50">
              <div className="text-gray-600 mb-1">Recommended Amount</div>
              <div><b>{app.recommendedAmount != null ? `UGX ${Math.round(app.recommendedAmount).toLocaleString()}` : "-"}</b></div>
            </div>
            <div className="rounded border p-3 bg-gray-50">
              <div className="text-gray-600 mb-1">Notes</div>
              <div className="text-xs text-gray-600">{app.decisionNotes || "—"}</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
