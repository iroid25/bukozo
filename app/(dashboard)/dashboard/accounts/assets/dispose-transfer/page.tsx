"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import axios from "axios";
import { toast } from "sonner";
import {
  ArrowLeftRight,
  CheckCircle2,
  Loader2,
  Plus,
  RotateCcw,
  Trash2,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AssetActionDialog } from "../components/AssetActionDialog";

type CurrentTransfer = {
  id: string;
  transferCode: string;
  amount: number;
  transferDate: string;
  receiptNo?: string | null;
  officerName?: string | null;
  status: string;
  notes?: string | null;
  sourceAsset?: { assetCode: string; assetName: string } | null;
  targetAsset?: { assetCode: string; assetName: string } | null;
};

type DisposalRow = {
  id: string;
  assetCode: string;
  assetName: string;
  category: string;
  status: string;
  disposalDate?: string | null;
  disposalMethod?: string | null;
  disposalAmount?: number | null;
  currentValue?: number | null;
  branch?: { name: string } | null;
};

type ActionTab = "transfer" | "dispose";

export default function DisposeTransferPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [transfers, setTransfers] = useState<CurrentTransfer[]>([]);
  const [disposals, setDisposals] = useState<DisposalRow[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTab, setDialogTab] = useState<ActionTab>("transfer");
  const [dialogAsset, setDialogAsset] = useState<any>(null);

  const fetchData = async () => {
    try {
      setRefreshing(true);
      const [transferResp, disposalResp] = await Promise.all([
        axios.get("/api/v1/current-asset-transfers"),
        axios.get("/api/v1/assets", {
          params: {
            assetType: "FIXED",
            status: "DISPOSED",
          },
        }),
      ]);

      setTransfers(
        Array.isArray(transferResp.data?.data) ? transferResp.data.data : [],
      );
      setDisposals(
        Array.isArray(disposalResp.data?.data) ? disposalResp.data.data : [],
      );
    } catch (error) {
      console.error("Failed to load asset actions", error);
      toast.error("Failed to load asset actions");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  const stats = useMemo(() => {
    const pendingTransfers = transfers.filter(
      (transfer) => transfer.status === "PENDING_APPROVAL",
    ).length;
    const approvedTransfers = transfers.filter(
      (transfer) => transfer.status === "APPROVED",
    ).length;
    const totalTransferValue = transfers.reduce(
      (sum, transfer) => sum + Number(transfer.amount || 0),
      0,
    );
    const totalDisposalValue = disposals.reduce(
      (sum, asset) => sum + Number(asset.disposalAmount || asset.currentValue || 0),
      0,
    );

    return {
      approvedTransfers,
      pendingTransfers,
      totalTransferValue,
      totalDisposalValue,
    };
  }, [disposals, transfers]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      maximumFractionDigits: 0,
    }).format(Number(value || 0));

  const approveTransfer = async (transferId: string) => {
    try {
      await axios.post(`/api/v1/current-asset-transfers/${transferId}/approve`);
      toast.success("Transfer approved");
      void fetchData();
    } catch (error: any) {
      toast.error(
        error?.response?.data?.details ||
          error?.response?.data?.error ||
          "Failed to approve transfer",
      );
    }
  };

  const rejectTransfer = async (transferId: string) => {
    const rejectionReason = window.prompt("Enter rejection reason");
    if (rejectionReason === null) return;

    try {
      await axios.post(`/api/v1/current-asset-transfers/${transferId}/reject`, {
        rejectionReason,
      });
      toast.success("Transfer rejected");
      void fetchData();
    } catch (error: any) {
      toast.error(
        error?.response?.data?.details ||
          error?.response?.data?.error ||
          "Failed to reject transfer",
      );
    }
  };

  const openDialog = (tab: ActionTab) => {
    setDialogAsset(null);
    setDialogTab(tab);
    setDialogOpen(true);
  };

  return (
    <div className="container mx-auto space-y-6 px-6 py-8">
      <div className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-white shadow-lg">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.16),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.22),transparent_28%)]" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-white/80">
              Asset Operations
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-black tracking-tight md:text-4xl">
                Dispose / Transfer
              </h1>
              <p className="max-w-2xl text-sm text-white/75 md:text-base">
                Review transfer and disposal history, then launch the popup to
                record a new action without leaving this workspace.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              asChild
              className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            >
              <Link href="/dashboard/accounts/assets">
                <RotateCcw className="mr-2 h-4 w-4" />
                Back to Assets
              </Link>
            </Button>
            <Button
              variant="secondary"
              onClick={() => openDialog("transfer")}
              className="bg-white text-slate-950 hover:bg-slate-100"
            >
              <ArrowLeftRight className="mr-2 h-4 w-4" />
              New Transfer
            </Button>
            <Button onClick={() => openDialog("dispose")}>
              <Plus className="mr-2 h-4 w-4" />
              Record Disposal
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-muted/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Transfers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-black">{transfers.length}</p>
            <p className="text-xs text-muted-foreground">
              {stats.pendingTransfers} pending approval
            </p>
          </CardContent>
        </Card>
        <Card className="border-muted/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Disposals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-black">{disposals.length}</p>
            <p className="text-xs text-muted-foreground">
              Fixed asset write-offs, sales, and donations
            </p>
          </CardContent>
        </Card>
        <Card className="border-muted/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Transfer Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-black">{formatCurrency(stats.totalTransferValue)}</p>
            <p className="text-xs text-muted-foreground">
              {stats.approvedTransfers} approved transfers
            </p>
          </CardContent>
        </Card>
        <Card className="border-muted/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Disposal Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-black">{formatCurrency(stats.totalDisposalValue)}</p>
            <p className="text-xs text-muted-foreground">
              Amount captured from disposed assets
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="transfers" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:w-[360px]">
          <TabsTrigger value="transfers">Transfers</TabsTrigger>
          <TabsTrigger value="disposals">Disposals</TabsTrigger>
        </TabsList>

        <TabsContent value="transfers" className="mt-6">
          <Card className="overflow-hidden border-slate-200/80 shadow-sm">
            <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-white">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <CardTitle className="flex items-center gap-2">
                  <ArrowLeftRight className="h-5 w-5 text-primary" />
                  Current Asset Transfers
                </CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openDialog("transfer")}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  New Transfer
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading || refreshing ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ref</TableHead>
                        <TableHead>Current Asset to Transfer</TableHead>
                        <TableHead>Transfer To</TableHead>
                        <TableHead>Receipt / Officer</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transfers.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={8}
                            className="py-10 text-center text-muted-foreground"
                          >
                            No transfers recorded yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        transfers.map((transfer) => (
                          <TableRow key={transfer.id}>
                            <TableCell className="font-mono text-xs">
                              {transfer.transferCode}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">
                                {transfer.sourceAsset?.assetName || "-"}
                              </div>
                              <div className="font-mono text-xs text-muted-foreground">
                                {transfer.sourceAsset?.assetCode || "-"}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">
                                {transfer.targetAsset?.assetName || "-"}
                              </div>
                              <div className="font-mono text-xs text-muted-foreground">
                                {transfer.targetAsset?.assetCode || "-"}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="font-mono text-xs">
                                {transfer.receiptNo || "-"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {transfer.officerName || "-"}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  transfer.status === "APPROVED"
                                    ? "default"
                                    : transfer.status === "REJECTED"
                                      ? "destructive"
                                      : "secondary"
                                }
                              >
                                {transfer.status.replaceAll("_", " ")}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {transfer.transferDate
                                ? new Date(transfer.transferDate).toLocaleDateString()
                                : "-"}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatCurrency(Number(transfer.amount || 0))}
                            </TableCell>
                            <TableCell className="text-right">
                              {transfer.status === "PENDING_APPROVAL" ? (
                                <div className="flex justify-end gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => void approveTransfer(transfer.id)}
                                  >
                                    <CheckCircle2 className="mr-2 h-4 w-4" />
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive"
                                    onClick={() => void rejectTransfer(transfer.id)}
                                  >
                                    <XCircle className="mr-2 h-4 w-4" />
                                    Reject
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  -
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="disposals" className="mt-6">
          <Card className="overflow-hidden border-slate-200/80 shadow-sm">
            <CardHeader className="border-b bg-gradient-to-r from-rose-50 to-white">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Trash2 className="h-5 w-5 text-destructive" />
                  Fixed Asset Disposals
                </CardTitle>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => openDialog("dispose")}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Record Disposal
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading || refreshing ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Asset</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Branch</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {disposals.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={7}
                            className="py-10 text-center text-muted-foreground"
                          >
                            No disposals recorded yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        disposals.map((asset) => (
                          <TableRow key={asset.id}>
                            <TableCell>
                              <div className="font-medium">{asset.assetName}</div>
                              <div className="font-mono text-xs text-muted-foreground">
                                {asset.assetCode}
                              </div>
                            </TableCell>
                            <TableCell>{asset.category}</TableCell>
                            <TableCell>
                              {(asset.disposalMethod || "-").replaceAll("_", " ")}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {asset.status.replaceAll("_", " ")}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {asset.disposalDate
                                ? new Date(asset.disposalDate).toLocaleDateString()
                                : "-"}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatCurrency(Number(asset.disposalAmount || 0))}
                            </TableCell>
                            <TableCell>{asset.branch?.name || "-"}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AssetActionDialog
        isOpen={dialogOpen}
        initialTab={dialogTab}
        disposalAsset={dialogAsset}
        onClose={() => setDialogOpen(false)}
        onSuccess={() => {
          void fetchData();
          setDialogOpen(false);
        }}
      />
    </div>
  );
}
