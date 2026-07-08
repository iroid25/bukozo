"use client";

import { useState } from "react";
import { 
  Building2, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Clock, 
  CheckCircle2, 
  TrendingDown,
  TrendingUp,
  ShieldCheck,
  History
} from "lucide-react";
import { format } from "date-fns";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import ProposeReserveAllocationModal from "./ProposeReserveAllocationModal";
import ConfirmReserveAllocationModal from "./ConfirmReserveAllocationModal";
import ProposeReserveReturnModal from "./ProposeReserveReturnModal";
import ConfirmReserveReturnModal from "./ConfirmReserveReturnModal";

interface BranchReserveDashboardProps {
  user: any;
  branches?: any[];
  pendingAllocations?: any[];
  organisationalReserve?: any;
  accountantVault?: any;
  history?: any[];
}

export default function BranchReserveDashboard({
  user,
  branches = [],
  pendingAllocations = [],
  organisationalReserve,
  accountantVault,
  history = [],
}: BranchReserveDashboardProps) {
  const isAdmin = user.role === "ADMIN";
  // Managers and Accountants share the same view actions for their branch
  const isBranchStaff = user.role === "ACCOUNTANT" || user.role === "BRANCHMANAGER";
  
  const [selectedBranch, setSelectedBranch] = useState<any>(null);
  const [selectedAllocation, setSelectedAllocation] = useState<any>(null);
  const [isAllocateModalOpen, setIsAllocateModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isConfirmReturnModalOpen, setIsConfirmReturnModalOpen] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleAllocate = (branch: any) => {
    setSelectedBranch(branch);
    setIsAllocateModalOpen(true);
  };

  const handleReview = (allocation: any) => {
    setSelectedAllocation(allocation);
    const isReturn = allocation.notes?.startsWith("RETURN");
    
    if (isReturn && isAdmin) {
        setIsConfirmReturnModalOpen(true);
    } else {
        setIsConfirmModalOpen(true);
    }
  };

  // Determine key metrics
  const currentBalance = isBranchStaff ? (accountantVault?.balance || 0) : (organisationalReserve?.balance || 0);
  const pendingCount = pendingAllocations.length;
  const isLowBalance = isBranchStaff && currentBalance < 5000000;

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 space-y-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="bg-white text-blue-700 border-blue-200 px-3 py-1">
              {isAdmin ? "Headquarters" : accountantVault?.branch?.name || "Branch Office"}
            </Badge>
            <span className="text-slate-400">/</span>
            <span className="text-slate-600 font-medium">Reserve Management</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
            {isAdmin ? "Sacco Reserve Overview" : "Branch Reserve"}
          </h1>
          <p className="text-slate-500 mt-2 text-lg">
            {isAdmin 
              ? "Monitor and allocate central funds to branches." 
              : "Manage your branch's operational liquidity."}
          </p>
        </div>
        
        {isBranchStaff && (
            <div className="flex gap-3">
              <Button 
                size="lg"
                className="bg-orange-600 hover:bg-orange-700 text-white shadow-lg shadow-orange-200 hover:shadow-xl transition-all"
                onClick={() => setIsReturnModalOpen(true)}
              >
                <ArrowDownLeft className="mr-2 h-5 w-5" />
                Propose Return
              </Button>
            </div>
        )}
      </div>

      {/* Metrics Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Main Balance Card */}
        <Card className="md:col-span-2 overflow-hidden border-none shadow-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white relative">
          <div className="absolute top-0 right-0 p-32 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
          <CardContent className="p-8 relative z-10 flex flex-col justify-between h-full">
            <div>
              <p className="text-blue-100 font-medium mb-1 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" /> 
                {isAdmin ? "Total Sacco Reserve" : "Current Branch Reserve"}
              </p>
              <h2 className="text-5xl font-bold tracking-tight mb-4">
                {formatCurrency(currentBalance)}
              </h2>
              <div className="flex items-center gap-3">
                 <Badge className="bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm">
                    Active
                 </Badge>
                 {isLowBalance && (
                    <Badge className="bg-amber-500 text-white border-0 animate-pulse">
                        Low Balance Warning
                    </Badge>
                 )}
              </div>
            </div>
            
            <div className="mt-8 grid grid-cols-2 gap-8 border-t border-white/10 pt-6">
                <div>
                    <p className="text-blue-200 text-sm mb-1">Physical Cash</p>
                    <p className="text-xl font-semibold">{formatCurrency(isBranchStaff ? accountantVault?.physicalCash || 0 : organisationalReserve?.physicalCash || 0)}</p>
                </div>
                <div>
                    <p className="text-blue-200 text-sm mb-1">Last Updated</p>
                    <p className="text-xl font-semibold">
                        {isBranchStaff && accountantVault?.updatedAt 
                            ? format(new Date(accountantVault.updatedAt), "MMM dd, HH:mm") 
                            : "Just Now"}
                    </p>
                </div>
            </div>
          </CardContent>
        </Card>

        {/* Pending Actions Card */}
        <Card className="border-none shadow-lg bg-white">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Clock className="h-5 w-5 text-amber-500" />
                    Pending Actions
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col items-center justify-center py-6 text-center">
                    <div className="text-5xl font-bold text-slate-900 mb-2">{pendingCount}</div>
                    <p className="text-slate-500 text-sm mb-6">Transactions requiring review</p>
                    {pendingCount > 0 ? (
                        <div className="w-full space-y-3">
                            {pendingAllocations.slice(0, 3).map(alloc => (
                                <div key={alloc.id} className="bg-slate-50 p-3 rounded-lg flex justify-between items-center text-sm border border-slate-100">
                                    <span className="font-medium text-slate-700">
                                        {alloc.notes?.startsWith("RETURN") ? "Return" : "Alloc."}
                                    </span>
                                    <span className="text-slate-500">{formatCurrency(alloc.amount)}</span>
                                </div>
                            ))}
                            {pendingCount > 3 && (
                                <p className="text-xs text-center text-muted-foreground">+{pendingCount - 3} more</p>
                            )}
                        </div>
                    ) : (
                        <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4" /> All clear
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
      </div>

      {/* Main Content Area */}
      <Card className="border-none shadow-lg bg-white overflow-hidden">
        <Tabs defaultValue={isAdmin ? "branches" : "history"} className="w-full">
            <div className="bg-slate-50/50 border-b border-slate-100 p-2">
                <TabsList className="bg-white border border-slate-200 shadow-sm">
                    {isAdmin && <TabsTrigger value="branches">Branch Status</TabsTrigger>}
                    <TabsTrigger value="pending">
                        Pending Actions 
                        {pendingCount > 0 && <Badge className="ml-2 bg-amber-500 h-5 w-5 p-0 flex items-center justify-center rounded-full text-[10px]">{pendingCount}</Badge>}
                    </TabsTrigger>
                    <TabsTrigger value="history">History</TabsTrigger>
                </TabsList>
            </div>

            <div className="p-6">
                {isAdmin && (
                  <TabsContent value="branches" className="mt-0 space-y-6">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900">Branch Reserve Status</h3>
                        <p className="text-slate-500">Real-time overview of branch liquidity levels.</p>
                    </div>
                    
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                        <Table>
                          <TableHeader className="bg-slate-50">
                            <TableRow>
                              <TableHead>Branch Name</TableHead>
                              <TableHead>Manager/Accountant</TableHead>
                              <TableHead>Reserve Balance</TableHead>
                              <TableHead>Health Status</TableHead>
                              <TableHead className="text-right">Allocation</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {branches.map((branch) => {
                              const activeVault =
                                branch.activeVault ?? branch.vaults?.[0];
                              const isLowBalance = activeVault && activeVault.balance < 5000000;
                              return (
                                <TableRow key={branch.id} className="hover:bg-slate-50/50">
                                  <TableCell className="font-semibold text-slate-700">{branch.name}</TableCell>
                                  <TableCell className="text-slate-600">{branch.accountant?.name || "Unassigned"}</TableCell>
                                  <TableCell className="font-medium text-slate-900">
                                    {activeVault ? formatCurrency(activeVault.balance) : "No Vault"}
                                  </TableCell>
                                  <TableCell>
                                    {!activeVault ? (
                                        <Badge variant="outline" className="text-slate-400">Inactive</Badge>
                                    ) : isLowBalance ? (
                                      <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200 border-none shadow-none">
                                        Low Funds
                                      </Badge>
                                    ) : (
                                      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none shadow-none">
                                        Healthy
                                      </Badge>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Button 
                                        size="sm" 
                                        className="bg-blue-600 hover:bg-blue-700 text-white"
                                        onClick={() => handleAllocate(branch)}
                                    >
                                      Fund Branch
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                    </div>
                  </TabsContent>
                )}

                <TabsContent value="pending" className="mt-0 space-y-6">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900">Pending Approvals</h3>
                        <p className="text-slate-500">Allocate requests or return proposals waiting for action.</p>
                    </div>

                    {pendingAllocations.length === 0 ? (
                        <div className="border-2 border-dashed border-slate-200 rounded-xl p-12 flex flex-col items-center justify-center text-center">
                            <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                <CheckCircle2 className="h-8 w-8 text-slate-400" />
                            </div>
                            <h4 className="text-lg font-medium text-slate-900">All caught up!</h4>
                            <p className="text-slate-500 max-w-sm mt-1">There are no pending actions requiring your attention at this time.</p>
                        </div>
                    ) : (
                        <div className="rounded-xl border border-slate-200 overflow-hidden">
                            <Table>
                              <TableHeader className="bg-slate-50">
                                <TableRow>
                                  <TableHead>Request Type</TableHead>
                                  <TableHead>Source/Target</TableHead>
                                  <TableHead>Amount</TableHead>
                                  <TableHead>Initiated By</TableHead>
                                  <TableHead>Date</TableHead>
                                  <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {pendingAllocations.map((alloc) => {
                                   const isReturn = alloc.notes?.startsWith("RETURN");
                                   return (
                                    <TableRow key={alloc.id} className="hover:bg-slate-50/50">
                                      <TableCell>
                                        <div className="flex items-center gap-2">
                                            {isReturn ? (
                                                <div className="p-1 bg-orange-100 rounded text-orange-600"><TrendingDown className="h-4 w-4" /></div>
                                            ) : (
                                                <div className="p-1 bg-blue-100 rounded text-blue-600"><TrendingUp className="h-4 w-4" /></div>
                                            )}
                                            <span className="font-medium text-slate-700">{isReturn ? "Return Proposal" : "Allocation Request"}</span>
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-slate-600">
                                        {alloc.targetVault?.branch?.name || alloc.sourceVault?.branch?.name}
                                      </TableCell>
                                      <TableCell className="font-bold text-slate-900">
                                        {formatCurrency(alloc.amount + (alloc.floatAmount || 0))}
                                      </TableCell>
                                      <TableCell>{alloc.allocatedByUser?.name}</TableCell>
                                      <TableCell className="text-slate-500">{format(new Date(alloc.createdAt), "MMM dd, yyyy")}</TableCell>
                                      <TableCell className="text-right">
                                        <Button 
                                            size="sm" 
                                            className="bg-slate-900 text-white hover:bg-slate-800"
                                            onClick={() => handleReview(alloc)}
                                        >
                                          Review & Confirm
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                   );
                                })}
                              </TableBody>
                            </Table>
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="history" className="mt-0 space-y-6">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900">Transaction History</h3>
                        <p className="text-slate-500">Comprehensive log of all reserve movements.</p>
                    </div>

                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                        <Table>
                          <TableHeader className="bg-slate-50">
                            <TableRow>
                              <TableHead>Type</TableHead>
                              <TableHead>Branch</TableHead>
                              <TableHead>Amount</TableHead>
                              <TableHead>Processed By</TableHead>
                              <TableHead>Date</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                             {history.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                        No history found
                                    </TableCell>
                                </TableRow>
                             ) : (
                                history.map((record) => {
                                  const isReturn = record.notes?.startsWith("RETURN");
                                  const branchName = record.targetVault?.branch?.name || record.sourceVault?.branch?.name;
                                  return (
                                    <TableRow key={record.id} className="hover:bg-slate-50/50">
                                      <TableCell>
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${isReturn ? "bg-orange-50 text-orange-700" : "bg-blue-50 text-blue-700"}`}>
                                           {isReturn ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                                           {isReturn ? "Return" : "Allocation"}
                                        </span>
                                      </TableCell>
                                      <TableCell className="font-medium text-slate-700">{branchName}</TableCell>
                                      <TableCell>{formatCurrency(record.amount + (record.floatAmount || 0))}</TableCell>
                                      <TableCell className="text-slate-600">{record.allocatedByUser?.name}</TableCell>
                                      <TableCell className="text-slate-500 text-sm">{format(new Date(record.createdAt), "MMM dd, yyyy")}</TableCell>
                                      <TableCell>
                                         <Badge 
                                            className={
                                                record.status === "APPROVED" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none shadow-none" :
                                                record.status === "PENDING" ? "bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200" : 
                                                "bg-slate-100 text-slate-700"
                                            }
                                         >
                                            {record.status}
                                         </Badge>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })
                             )}
                          </TableBody>
                        </Table>
                    </div>
                </TabsContent>
            </div>
        </Tabs>
      </Card>

      {/* Modals */}
      <ProposeReserveAllocationModal 
        isOpen={isAllocateModalOpen}
        onClose={() => setIsAllocateModalOpen(false)}
        targetBranch={selectedBranch}
        sourceVault={organisationalReserve}
      />

      <ConfirmReserveAllocationModal 
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        allocation={selectedAllocation}
      />

      <ProposeReserveReturnModal 
        isOpen={isReturnModalOpen}
        onClose={() => setIsReturnModalOpen(false)}
        sourceBranchVault={accountantVault}
        targetOrgReserve={organisationalReserve}
      />

      <ConfirmReserveReturnModal 
        isOpen={isConfirmReturnModalOpen}
        onClose={() => setIsConfirmReturnModalOpen(false)}
        allocation={selectedAllocation}
      />
    </div>
  );
}
