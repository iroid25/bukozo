"use client";

import { useState } from "react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import * as XLSX from "xlsx";

import {
  Column,
  DataTable,
} from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import LoanRescheduleRequestForm from "../components/LoanRescheduleRequestForm";

interface RescheduleRequest {
  id: string;
  loanId: string;
  oldDueDate: Date;
  newDueDate: Date;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: Date;
  loan?: {
    member: {
      user: {
        name: string;
      };
      memberNumber: string;
    };
    branch: {
      name: string;
    } | null;
    outstandingBalance: number;
    amountGranted: number;
  } | null;
  institutionLoan?: {
    institution: {
      institutionName: string;
      institutionNumber: string;
      user: { branchId?: string | null };
    };
    outstandingBalance: number;
    amountGranted: number;
  } | null;
  requestedBy: {
    name: string;
    role: string;
  };
  approvedBy: {
    name: string;
  } | null;
  // New fields
  village?: string;
  parish?: string;
  county?: string;
  spouseName?: string;
  spouseContact?: string;
  spouseNIN?: string;
  rescheduleAmount?: number;
  reschedulePeriod?: string;
  securityType?: string;
  securityDescription?: string;
  securityPurchasePrice?: number;
  securityCurrentPrice?: number;
  securityValuation?: number;
  forcedSaleValue?: number;
  guarantors?: any;
  officerComment?: string;
  managerComment?: string;
  committeeComment?: string;
  minuteNumber?: string;
}

interface Props {
  data: any[];
  userRole: string;
  currentUserId: string;
}

export default function LoanReschedulesClient({ data, userRole }: Props) {
  const router = useRouter();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<RescheduleRequest | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [managerComment, setManagerComment] = useState("");
  const [committeeComment, setCommitteeComment] = useState("");
  const [minuteNumber, setMinuteNumber] = useState("");
  const [approvedAmount, setApprovedAmount] = useState("");

  const handleAddNew = () => {
    setIsModalOpen(true);
  };

  const handleAction = async (id: string, status: "APPROVED" | "REJECTED") => {
    try {
      setProcessingId(id);
      const res = await fetch(`/api/v1/loans/reschedules/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          status,
          managerComment,
          committeeComment,
          minuteNumber,
          approvedAmount: approvedAmount ? parseFloat(approvedAmount) : undefined
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      toast.success(result.message);
      setIsDetailOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setProcessingId(null);
    }
  };

  const getBorrowerName = (item: RescheduleRequest) =>
    item.loan?.member?.user?.name || item.institutionLoan?.institution?.institutionName || "Unknown";
  const getBorrowerNumber = (item: RescheduleRequest) =>
    item.loan?.member?.memberNumber || item.institutionLoan?.institution?.institutionNumber || "";
  const getBranchName = (item: RescheduleRequest) =>
    item.loan?.branch?.name || (item.institutionLoan ? "—" : "");
  const isInstitutionItem = (item: RescheduleRequest) => !!item.institutionLoan;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "APPROVED":
        return "default"; // Greenish usually if handled by badge variant or class
      case "REJECTED":
        return "destructive";
      default:
        return "secondary";
    }
  };
  
  const handleExport = async (filteredData: RescheduleRequest[]) => {
    try {
      const exportData = filteredData.map((item) => ({
        "Member Name": getBorrowerName(item),
        "Member Number": getBorrowerNumber(item),
        "Branch": getBranchName(item) || "N/A",
        "Current Due Date": format(new Date(item.oldDueDate), "yyyy-MM-dd"),
        "Requested Due Date": format(new Date(item.newDueDate), "yyyy-MM-dd"),
        "Reason": item.reason,
        "Status": item.status,
        "Requested By": item.requestedBy.name,
        "Date Requested": format(new Date(item.createdAt), "yyyy-MM-dd HH:mm"),
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Reschedules");

      const fileName = `Loan_Reschedules_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      toast.success("Export successful");
    } catch (error) {
       toast.error("Export failed");
    }
  };

  const columns: Column<RescheduleRequest>[] = [
    {
      accessorKey: (row) => getBorrowerName(row),
      header: "Member",
      cell: (row) => (
        <div>
          <p className="font-medium">
            {getBorrowerName(row)}
            {isInstitutionItem(row) && (
              <Badge variant="outline" className="ml-2 text-xs">Institution</Badge>
            )}
          </p>
          <p className="text-sm text-muted-foreground">
            {getBorrowerNumber(row)}
          </p>
          <p className="text-xs text-muted-foreground">
            {getBranchName(row)}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "oldDueDate",
      header: "Current Due Date",
      cell: (row) => <span>{format(new Date(row.oldDueDate), "MMM d, yyyy")}</span>,
    },
    {
      accessorKey: "newDueDate",
      header: "Requested Date",
      cell: (row) => (
        <span className="font-medium text-blue-600">
          {format(new Date(row.newDueDate), "MMM d, yyyy")}
        </span>
      ),
    },
    {
      accessorKey: "reason",
      header: "Reason",
      cell: (row) => (
         <div className="max-w-[200px] truncate" title={row.reason}>
            {row.reason}
         </div>
      ),
    },
    {
        accessorKey: "status",
        header: "Status",
        cell: (row) => {
            const variant = getStatusColor(row.status) as "default" | "destructive" | "secondary" | "outline";
             return <Badge variant={variant}>{row.status}</Badge>
        }
    },
    {
        accessorKey: (row) => row.requestedBy.name,
        header: "Requested By",
        cell: (row) => (
             <div className="text-sm">
                <p>{row.requestedBy.name}</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(row.createdAt), "MMM d, HH:mm")}
                </p>
              </div>
        )
    },
    {
      accessorKey: (row) => row.id,
      header: "Actions",
      cell: (row) => {
        return (
          <div className="flex gap-2">
             <Button 
                size="sm" 
                variant="outline" 
                onClick={() => {
                  setSelectedRequest(row);
                  setIsDetailOpen(true);
                  setManagerComment(row.managerComment || "");
                  setCommitteeComment(row.committeeComment || "");
                  setMinuteNumber(row.minuteNumber || "");
                }}
              >
                Review
              </Button>
          </div>
        )
      },
    },
  ];


  return (
    <div className="container mx-auto py-6">
      <LoanRescheduleRequestForm
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

       <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle>Review Reschedule Application</DialogTitle>
            <DialogDescription>
              Check details and provide approval comments.
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <ScrollArea className="flex-1 p-6 overflow-y-auto">
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-lg">
                   <div><p className="text-xs text-muted-foreground uppercase font-bold">{isInstitutionItem(selectedRequest) ? "Institution" : "Member"}</p><p className="font-medium">{getBorrowerName(selectedRequest)}</p></div>
                   <div><p className="text-xs text-muted-foreground uppercase font-bold">Outstanding</p><p className="font-medium">UGX {(selectedRequest.loan?.outstandingBalance ?? selectedRequest.institutionLoan?.outstandingBalance ?? 0).toLocaleString()}</p></div>
                   <div><p className="text-xs text-muted-foreground uppercase font-bold">Old Due Date</p><p className="font-medium">{format(new Date(selectedRequest.oldDueDate), "PPP")}</p></div>
                   <div><p className="text-xs text-muted-foreground uppercase font-bold">New Due Date</p><p className="font-medium text-blue-600">{format(new Date(selectedRequest.newDueDate), "PPP")}</p></div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-bold border-b pb-1 text-sm text-primary">PERSONNAL & ADDRESS</h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div><p className="text-muted-foreground">Village</p><p>{selectedRequest.village || "N/A"}</p></div>
                    <div><p className="text-muted-foreground">Parish</p><p>{selectedRequest.parish || "N/A"}</p></div>
                    <div><p className="text-muted-foreground">County</p><p>{selectedRequest.county || "N/A"}</p></div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div><p className="text-muted-foreground">Spouse</p><p>{selectedRequest.spouseName || "N/A"}</p></div>
                    <div><p className="text-muted-foreground">Spouse NIN</p><p>{selectedRequest.spouseNIN || "N/A"}</p></div>
                    <div><p className="text-muted-foreground">Contact</p><p>{selectedRequest.spouseContact || "N/A"}</p></div>
                  </div>
                </div>

                <div className="space-y-4">
                   <h4 className="font-bold border-b pb-1 text-sm text-primary">SECURITY & COLLATERAL</h4>
                   <div className="grid grid-cols-2 gap-4 text-sm">
                      <div><p className="text-muted-foreground">Type</p><p>{selectedRequest.securityType || "N/A"}</p></div>
                      <div><p className="text-muted-foreground">Description</p><p>{selectedRequest.securityDescription || "N/A"}</p></div>
                   </div>
                   <div className="grid grid-cols-4 gap-2 text-xs">
                      <div className="bg-muted p-2 rounded">Purchase: {selectedRequest.securityPurchasePrice?.toLocaleString()}</div>
                      <div className="bg-muted p-2 rounded">Current: {selectedRequest.securityCurrentPrice?.toLocaleString()}</div>
                      <div className="bg-muted p-2 rounded">Valuation: {selectedRequest.securityValuation?.toLocaleString()}</div>
                      <div className="bg-muted p-2 rounded">Forced Sale: {selectedRequest.forcedSaleValue?.toLocaleString()}</div>
                   </div>
                </div>

                <div className="space-y-4">
                   <h4 className="font-bold border-b pb-1 text-sm text-primary">OFFICER COMMENT</h4>
                   <p className="text-sm bg-orange-50 p-3 rounded italic">{selectedRequest.officerComment || "No comment provided"}</p>
                </div>

                {selectedRequest.status === "PENDING" && (
                   <div className="space-y-4 border-t pt-4">
                      <h4 className="font-bold text-sm text-blue-600">MANAGEMENT & COMMITTEE REVIEW</h4>
                      <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-2">
                            <label className="text-xs font-bold">Committee Minute Number</label>
                            <Input value={minuteNumber} onChange={(e) => setMinuteNumber(e.target.value)} placeholder="Enter minute ref..." />
                         </div>
                         <div className="space-y-2">
                            <label className="text-xs font-bold">Approved Reschedule Amount (Optional)</label>
                            <Input 
                              type="number" 
                              value={approvedAmount} 
                              onChange={(e) => setApprovedAmount(e.target.value)} 
                              placeholder="Defaults to balance" 
                            />
                         </div>
                      </div>
                      <div className="space-y-2">
                          <label className="text-xs font-bold">Manager's Comment</label>
                          <Textarea value={managerComment} onChange={(e) => setManagerComment(e.target.value)} placeholder="Manager's evaluation..." />
                      </div>
                      <div className="space-y-2">
                          <label className="text-xs font-bold">Committee Decision/Comment</label>
                          <Textarea value={committeeComment} onChange={(e) => setCommitteeComment(e.target.value)} placeholder="Board/Committee notes..." />
                      </div>
                   </div>
                )}
              </div>
            </ScrollArea>
          )}

          <DialogFooter className="p-6 border-t mt-auto">
             <Button variant="outline" onClick={() => setIsDetailOpen(false)}>Close</Button>
             {selectedRequest?.status === "PENDING" && (
               <>
                <Button variant="destructive" onClick={() => handleAction(selectedRequest.id, "REJECTED")} disabled={processingId === selectedRequest.id}>Reject</Button>
                <Button onClick={() => handleAction(selectedRequest.id, "APPROVED")} disabled={processingId === selectedRequest.id}>Approve & Reschedule</Button>
               </>
             )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <DataTable<RescheduleRequest>
        title="Reschedule Requests"
        subtitle="Manage loan reschedule applications"
        data={data}
        columns={columns}
        keyField="id"
        isLoading={false}
        onRefresh={() => router.refresh()}
        actions={{
          onExport: handleExport,
          onAdd: handleAddNew,
        }}
        filters={{
          searchFields: ["reason", "status"], // Basic search
          enableDateFilter: true,
          getItemDate: (item) => new Date(item.createdAt),
        }}
      />
    </div>
  );
}
