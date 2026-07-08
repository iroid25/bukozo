// app/dashboard/accountant/reconciliations/ReconciliationListing.tsx
"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CheckCircle,
  XCircle,
  Clock,
  FileCheck,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  PendingReconciliation,
  ProcessedReconciliation,
  Reconciliation,
} from "@/types/reconciliation";
import { ReconciliationTable } from "./components/ReconciliationTable";
import { ActionDialog } from "./components/ActionDialog";

interface ReconciliationsListingProps {
  pendingReconciliations: PendingReconciliation[];
  approvedReconciliations: ProcessedReconciliation[];
  rejectedReconciliations: ProcessedReconciliation[];
  userId: string;
}

export default function ReconciliationsListing({
  pendingReconciliations = [],
  approvedReconciliations = [],
  rejectedReconciliations = [],
  userId,
}: ReconciliationsListingProps) {
  const router = useRouter();
  const [selectedRec, setSelectedRec] = useState<Reconciliation | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 1000);
    toast.success("Reconciliations refreshed");
  }, [router]);

  const handleApprove = useCallback(
    async (notes: string) => {
      if (!selectedRec) return;

      setLoading(true);
      try {
        console.log("🔄 Approving reconciliation:", selectedRec.id);

        const response = await fetch(
          `/api/v1/accountant/reconciliation/${selectedRec.id}/approve`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ notes }),
          }
        );

        const result = await response.json();

        console.log("✅ Approval result:", result);

        if (!response.ok || !result.success) {
          toast.error("Approval Failed", {
            description: result.error,
          });
        } else {
          toast.success("✅ Reconciliation Approved!", {
            description: `UGX ${selectedRec.actualCash?.toLocaleString()} added to vault. Teller can now start a new day.`,
            duration: 5000,
          });

          setSelectedRec(null);
          setActionType(null);

          // Refresh the page data
          router.refresh();
        }
      } catch (error) {
        console.error("❌ Approval error:", error);
        toast.error("Approval Failed", {
          description:
            error instanceof Error
              ? error.message
              : "An unexpected error occurred",
        });
      } finally {
        setLoading(false);
      }
    },
    [selectedRec, userId, router]
  );

  const handleReject = useCallback(
    async (notes: string) => {
      if (!selectedRec) return;

      if (!notes.trim()) {
        toast.error("Rejection reason is required");
        return;
      }

      setLoading(true);
      try {
        console.log("🔄 Rejecting reconciliation:", selectedRec.id);

        const response = await fetch(
          `/api/v1/accountant/reconciliation/${selectedRec.id}/reject`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ rejectionReason: notes }),
          }
        );

        const result = await response.json();

        console.log("✅ Rejection result:", result);

        if (!response.ok || !result.success) {
          toast.error("Rejection Failed", {
            description: result.error,
          });
        } else {
          toast.success("❌ Reconciliation Rejected", {
            description: "Teller has been notified and can resubmit.",
            duration: 5000,
          });

          setSelectedRec(null);
          setActionType(null);

          // Refresh the page data
          router.refresh();
        }
      } catch (error) {
        console.error("❌ Rejection error:", error);
        toast.error("Rejection Failed", {
          description:
            error instanceof Error
              ? error.message
              : "An unexpected error occurred",
        });
      } finally {
        setLoading(false);
      }
    },
    [selectedRec, userId, router]
  );

  const openApproveDialog = useCallback(
    (id: string) => {
      const rec = pendingReconciliations.find((r) => r.id === id);
      if (rec) {
        console.log("Opening approve dialog for:", rec);
        setSelectedRec(rec);
        setActionType("approve");
      } else {
        console.error("Reconciliation not found:", id);
        toast.error("Reconciliation not found");
      }
    },
    [pendingReconciliations]
  );

  const openRejectDialog = useCallback(
    (id: string) => {
      const rec = pendingReconciliations.find((r) => r.id === id);
      if (rec) {
        console.log("Opening reject dialog for:", rec);
        setSelectedRec(rec);
        setActionType("reject");
      } else {
        console.error("Reconciliation not found:", id);
        toast.error("Reconciliation not found");
      }
    },
    [pendingReconciliations]
  );

  const closeDialog = useCallback(() => {
    setSelectedRec(null);
    setActionType(null);
  }, []);

  const handleDialogConfirm = useCallback(
    (notes: string) => {
      if (actionType === "approve") {
        handleApprove(notes);
      } else {
        handleReject(notes);
      }
    },
    [actionType, handleApprove, handleReject]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <FileCheck className="h-8 w-8 text-blue-600" />
            Reconciliations Management
          </h1>
          <p className="text-gray-600 mt-1">
            Review and manage float reconciliations
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={refreshing}
          variant="outline"
          className="flex items-center gap-2"
        >
          <RefreshCw
            className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-orange-50 border-orange-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-orange-800 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Pending Approval
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-700">
              {pendingReconciliations.length}
            </div>
            <p className="text-xs text-orange-600 mt-1">Awaiting your review</p>
          </CardContent>
        </Card>

        <Card className="bg-green-50 border-green-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-green-800 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Approved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-700">
              {approvedReconciliations.length}
            </div>
            <p className="text-xs text-green-600 mt-1">
              Successfully processed
            </p>
          </CardContent>
        </Card>

        <Card className="bg-red-50 border-red-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-red-800 flex items-center gap-2">
              <XCircle className="h-4 w-4" />
              Rejected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-700">
              {rejectedReconciliations.length}
            </div>
            <p className="text-xs text-red-600 mt-1">Declined requests</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList>
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Pending ({pendingReconciliations.length})
          </TabsTrigger>
          <TabsTrigger value="approved" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Approved ({approvedReconciliations.length})
          </TabsTrigger>
          <TabsTrigger value="rejected" className="flex items-center gap-2">
            <XCircle className="h-4 w-4" />
            Rejected ({rejectedReconciliations.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle>Pending Reconciliations</CardTitle>
              <CardDescription>
                {pendingReconciliations.length > 0
                  ? `${pendingReconciliations.length} reconciliation(s) awaiting your approval`
                  : "No pending reconciliations"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendingReconciliations.length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-gray-700 mb-1">
                    No Pending Reconciliations
                  </h3>
                  <p className="text-sm text-gray-500">
                    All reconciliations have been processed
                  </p>
                </div>
              ) : (
                <ReconciliationTable
                  data={pendingReconciliations}
                  type="pending"
                  onApprove={openApproveDialog}
                  onReject={openRejectDialog}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approved">
          <Card>
            <CardHeader>
              <CardTitle>Approved Reconciliations</CardTitle>
              <CardDescription>
                {approvedReconciliations.length > 0
                  ? `${approvedReconciliations.length} successfully approved reconciliation(s)`
                  : "No approved reconciliations yet"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {approvedReconciliations.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-gray-700 mb-1">
                    No Approved Reconciliations
                  </h3>
                  <p className="text-sm text-gray-500">
                    Approved reconciliations will appear here
                  </p>
                </div>
              ) : (
                <ReconciliationTable
                  data={approvedReconciliations}
                  type="approved"
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rejected">
          <Card>
            <CardHeader>
              <CardTitle>Rejected Reconciliations</CardTitle>
              <CardDescription>
                {rejectedReconciliations.length > 0
                  ? `${rejectedReconciliations.length} rejected reconciliation(s)`
                  : "No rejected reconciliations"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {rejectedReconciliations.length === 0 ? (
                <div className="text-center py-12">
                  <XCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-gray-700 mb-1">
                    No Rejected Reconciliations
                  </h3>
                  <p className="text-sm text-gray-500">
                    Rejected reconciliations will appear here
                  </p>
                </div>
              ) : (
                <ReconciliationTable
                  data={rejectedReconciliations}
                  type="rejected"
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ActionDialog
        reconciliation={selectedRec}
        actionType={actionType}
        isLoading={loading}
        onClose={closeDialog}
        onConfirm={handleDialogConfirm}
      />
    </div>
  );
}
