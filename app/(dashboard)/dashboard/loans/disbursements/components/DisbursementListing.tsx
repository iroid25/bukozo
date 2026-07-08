"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CheckCircle,
  Clock,
  DollarSign,
  FileText,
  User,
  ArrowRight
} from "lucide-react";
import { formatCurrency } from "@/lib/utils"; // Assuming this exists, or I'll define it
import { Loan } from "@/types/loan";


type LoanWithDetails = Loan & {
  loanApplication: {
    id: string;
    purpose: string | null;
    applicationDate: Date;
    approvalDate?: Date | null;
    loanProduct?: {
      name: string;
    };
  };
  allocatedTeller?: {
    name: string;
  } | null;
};

interface DisbursementListingProps {
  pendingLoans: LoanWithDetails[];
  disbursedLoans: LoanWithDetails[];
  userRole: string;
}

export default function DisbursementListing({
  pendingLoans,
  disbursedLoans,
  userRole,
}: DisbursementListingProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("pending");

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Disbursement Requests</h1>
        <p className="text-muted-foreground">
          Manage loan disbursements and view history.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingLoans.length}</div>
            <p className="text-xs text-muted-foreground">Awaiting disbursement</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Disbursements</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{disbursedLoans.length}</div>
            <p className="text-xs text-muted-foreground">Successfully processed</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pending" className="w-full" onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="pending">Pending Disbursements</TabsTrigger>
          <TabsTrigger value="history">Disbursement History</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending Requests</CardTitle>
            </CardHeader>
            <CardContent>
              {pendingLoans.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mb-2 text-gray-300" />
                  <p>No pending disbursement requests found.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Loan Product</TableHead>
                      <TableHead>Amount Approved</TableHead>
                      <TableHead>Approval Date</TableHead>
                      <TableHead>Teller</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingLoans.map((loan) => (
                      <TableRow key={loan.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{loan.member?.user?.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {loan.member?.memberNumber}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{loan.loanApplication?.loanProduct?.name}</TableCell>
                        <TableCell className="font-medium text-green-600">
                          {formatMoney(loan.amountGranted)}
                        </TableCell>
                        <TableCell>
                          {loan.loanApplication?.approvalDate
                            ? format(new Date(loan.loanApplication.approvalDate), "MMM dd, yyyy")
                            : "N/A"}
                        </TableCell>
                        <TableCell>
                             {loan.allocatedTeller?.name || <span className="text-gray-400 italic">Unassigned</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            size="sm" 
                            onClick={() => router.push(`/dashboard/loans/${loan.id}`)}
                            className="bg-indigo-600 hover:bg-indigo-700"
                          >
                            Process <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Disbursement History</CardTitle>
            </CardHeader>
            <CardContent>
              {disbursedLoans.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                  <FileText className="h-12 w-12 mb-2 text-gray-300" />
                  <p>No disbursement history found.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Loan Product</TableHead>
                      <TableHead>Amount Disbursed</TableHead>
                      <TableHead>Disbursed On</TableHead>
                      <TableHead>Disbursed By</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {disbursedLoans.map((loan) => (
                      <TableRow key={loan.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{loan.member?.user?.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {loan.member?.memberNumber}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{loan.loanApplication?.loanProduct?.name}</TableCell>
                        <TableCell className="font-medium">
                          {formatMoney(loan.amountGranted)}
                        </TableCell>
                        <TableCell>
                          {loan.disbursementDate
                            ? format(new Date(loan.disbursementDate), "MMM dd, yyyy")
                            : "N/A"}
                        </TableCell>
                        <TableCell>{loan.disbursedByUser?.name || "N/A"}</TableCell>
                        <TableCell>
                          <Badge variant={loan.status === "REPAID" ? "default" : "secondary"}>
                            {loan.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => router.push(`/dashboard/loans/${loan.id}`)}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
