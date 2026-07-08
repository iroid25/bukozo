"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { format } from "date-fns";
import { AlertCircle, CheckCircle2, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import DisburseLoanForm from "./DisburseLoanForm";

interface Props {
  userId: string;
}

export default function TellerLoansClient({ userId }: Props) {
  const { data: loansData, isLoading: loansLoading } = useQuery({
    queryKey: ["teller-loans", userId],
    queryFn: async () => {
      const res = await axios.get("/api/v1/loans?status=APPROVED");
      return res.data.success ? (res.data.data ?? []) : [];
    },
    refetchOnWindowFocus: true,
  });

  const { data: reserveData, isLoading: reserveLoading } = useQuery({
    queryKey: ["branch-reserve-balance"],
    queryFn: async () => {
      const res = await axios.get("/api/v1/vault/balance");
      return res.data ?? null;
    },
    refetchOnWindowFocus: true,
  });

  const loans: any[] = loansData ?? [];
  const reserveBalance: number = reserveData?.balance ?? 0;

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Loans to Disburse</h1>
          <p className="text-muted-foreground">
            Process disbursements for loans assigned to you.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-lg border border-blue-100">
          <Wallet className="h-5 w-5 text-blue-600" />
          <div className="flex flex-col">
            <span className="text-xs text-blue-600 font-medium">Branch Reserve Balance</span>
            {reserveLoading ? (
              <Skeleton className="h-6 w-28 mt-1" />
            ) : (
              <span className="text-lg font-bold text-blue-800">
                UGX {reserveBalance.toLocaleString()}
              </span>
            )}
          </div>
        </div>
      </div>

      {loansLoading ? (
        <div className="grid grid-cols-1 gap-4">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardContent className="py-6">
                <Skeleton className="h-6 w-48 mb-4" />
                <div className="grid md:grid-cols-3 gap-6">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : loans.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-green-500/50" />
            <p className="text-lg font-medium">No pending disbursements</p>
            <p>Great job! You have cleared your disbursement queue.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {loans.map((loan: any) => (
            <Card key={loan.id} className="overflow-hidden">
              <CardHeader className="bg-muted/30 pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      {loan.member?.user?.name || "Unknown member"}
                      <Badge variant="outline" className="font-normal">
                        #{loan.member?.memberNumber || "N/A"}
                      </Badge>
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {loan.loanApplication?.loanProduct?.name || "Loan"}
                    </p>
                  </div>
                  <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 border-orange-200">
                    Approved
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid md:grid-cols-3 gap-6 mb-4">
                  <div>
                    <span className="text-sm text-muted-foreground">Approved Amount</span>
                    <p className="text-xl font-bold text-green-600">
                      UGX {loan.amountGranted.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Approval Date</span>
                    <p className="font-medium">
                      {loan.loanApplication?.approvalDate
                        ? format(new Date(loan.loanApplication.approvalDate), "PPP")
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Disbursement Method</span>
                    <p className="font-medium capitalize">
                      {loan.loanApplication?.disbursementMethod || "Cash"}
                    </p>
                  </div>
                </div>
                <div className="flex justify-end pt-2 border-t mt-2">
                  <DisburseLoanForm loan={loan} currentReserve={reserveBalance} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
