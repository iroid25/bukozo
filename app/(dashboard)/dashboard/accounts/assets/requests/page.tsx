"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { CheckCircle2, Loader2, RotateCcw, Search, ShieldAlert, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type TransferRequest = {
  id: string;
  transferCode: string;
  amount: number;
  transferDate: string;
  receiptNo?: string | null;
  officerName?: string | null;
  status: string;
  notes?: string | null;
  branch?: { name: string } | null;
  requestedBy?: { name?: string | null } | null;
  sourceAsset?: { assetCode: string; assetName: string } | null;
  targetAsset?: { assetCode: string; assetName: string } | null;
};

type DisposalRequest = {
  id: string;
  assetCode: string;
  assetName: string;
  category: string;
  status: string;
  approvalStatus: string;
  disposalDate?: string | null;
  disposalMethod?: string | null;
  disposalAmount?: number | null;
  disposalNotes?: string | null;
  branch?: { name: string } | null;
  responsiblePerson?: { name?: string | null } | null;
};

export default function AssetRequestsPage() {
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [transferRequests, setTransferRequests] = useState<TransferRequest[]>([]);
  const [disposalRequests, setDisposalRequests] = useState<DisposalRequest[]>([]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [transferResp, disposalResp] = await Promise.all([
        axios.get("/api/v1/current-asset-transfers", {
          params: { status: "PENDING_APPROVAL" },
        }),
        axios.get("/api/v1/assets", {
          params: {
            assetType: "FIXED",
            status: "ACTIVE",
            approvalStatus: "PENDING_APPROVAL",
          },
        }),
      ]);

      setTransferRequests(
        Array.isArray(transferResp.data?.data) ? transferResp.data.data : [],
      );
      setDisposalRequests(
        Array.isArray(disposalResp.data?.data) ? disposalResp.data.data : [],
      );
    } catch (error) {
      console.error("Failed to load asset requests", error);
      toast.error("Failed to load asset requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      maximumFractionDigits: 0,
    }).format(Number(value || 0));

  const stats = useMemo(
    () => ({
      totalTransfers: transferRequests.length,
      totalDisposals: disposalRequests.length,
      totalPending: transferRequests.length + disposalRequests.length,
    }),
    [disposalRequests.length, transferRequests.length],
  );

  const filteredTransfers = transferRequests.filter((item) => {
    const haystack = `${item.transferCode} ${item.receiptNo || ""} ${item.officerName || ""} ${item.sourceAsset?.assetName || ""} ${item.targetAsset?.assetName || ""} ${item.branch?.name || ""}`.toLowerCase();
    return haystack.includes(searchQuery.toLowerCase());
  });

  const filteredDisposals = disposalRequests.filter((item) => {
    const haystack = `${item.assetCode} ${item.assetName} ${item.category} ${item.branch?.name || ""}`.toLowerCase();
    return haystack.includes(searchQuery.toLowerCase());
  });

  const approveTransfer = async (id: string) => {
    try {
      await axios.post(`/api/v1/current-asset-transfers/${id}/approve`);
      toast.success("Transfer approved");
      void fetchData();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Failed to approve transfer");
    }
  };

  const rejectTransfer = async (id: string) => {
    const rejectionReason = window.prompt("Enter rejection reason");
    if (rejectionReason === null) return;
    try {
      await axios.post(`/api/v1/current-asset-transfers/${id}/reject`, {
        rejectionReason,
      });
      toast.success("Transfer rejected");
      void fetchData();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Failed to reject transfer");
    }
  };

  const approveDisposal = async (id: string) => {
    try {
      await axios.post(`/api/v1/fixed-assets/${id}/approve`);
      toast.success("Disposal approved and posted");
      void fetchData();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Failed to approve disposal");
    }
  };

  const rejectDisposal = async (id: string) => {
    const rejectionReason = window.prompt("Enter rejection reason");
    if (rejectionReason === null) return;
    try {
      await axios.post(`/api/v1/fixed-assets/${id}/reject`, { rejectionReason });
      toast.success("Disposal rejected");
      void fetchData();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Failed to reject disposal");
    }
  };

  return (
    <div className="container mx-auto space-y-6 px-6 py-8">
      <div className="rounded-3xl border bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-white shadow-lg">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-white/80">
              Approval Queue
            </div>
            <h1 className="text-3xl font-black tracking-tight md:text-4xl">
              Transfer & Disposal Requests
            </h1>
            <p className="max-w-2xl text-sm text-white/75 md:text-base">
              Review pending current-asset transfers and fixed-asset disposal requests before values are posted to the books.
            </p>
          </div>
          <Button variant="outline" asChild className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white">
            <a href="/dashboard/accounts/assets/dispose-transfer">
              <RotateCcw className="mr-2 h-4 w-4" />
              Back to History
            </a>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Pending Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-black">{stats.totalPending}</p>
            <p className="text-xs text-muted-foreground">Waiting for approval</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Transfer Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-black">{stats.totalTransfers}</p>
            <p className="text-xs text-muted-foreground">Pending current-asset moves</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Disposal Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-black">{stats.totalDisposals}</p>
            <p className="text-xs text-muted-foreground">Fixed assets awaiting decision</p>
          </CardContent>
        </Card>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search requests by asset, branch, or reference..."
          className="pl-9"
        />
      </div>

      <Tabs defaultValue="transfers" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:w-[360px]">
          <TabsTrigger value="transfers">
            Transfers ({filteredTransfers.length})
          </TabsTrigger>
          <TabsTrigger value="disposals">
            Disposals ({filteredDisposals.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transfers" className="mt-6">
          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-muted/20">
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-amber-600" />
                Pending Transfer Requests
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
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
                        <TableHead>Branch</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTransfers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                            No pending transfer requests.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredTransfers.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-mono text-xs">
                              {item.transferCode}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{item.sourceAsset?.assetName || "-"}</div>
                              <div className="font-mono text-xs text-muted-foreground">
                                {item.sourceAsset?.assetCode || "-"}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{item.targetAsset?.assetName || "-"}</div>
                              <div className="font-mono text-xs text-muted-foreground">
                                {item.targetAsset?.assetCode || "-"}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="font-mono text-xs">{item.receiptNo || "-"}</div>
                              <div className="text-xs text-muted-foreground">
                                {item.officerName || "-"}
                              </div>
                            </TableCell>
                            <TableCell>{item.branch?.name || "-"}</TableCell>
                            <TableCell className="text-right font-mono">
                              {formatCurrency(Number(item.amount || 0))}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button size="sm" onClick={() => void approveTransfer(item.id)}>
                                  <CheckCircle2 className="mr-2 h-4 w-4" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive"
                                  onClick={() => void rejectTransfer(item.id)}
                                >
                                  <XCircle className="mr-2 h-4 w-4" />
                                  Reject
                                </Button>
                              </div>
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
          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-muted/20">
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-rose-600" />
                Pending Disposal Requests
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Asset</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Branch</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDisposals.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                            No pending disposal requests.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredDisposals.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div className="font-medium">{item.assetName}</div>
                              <div className="font-mono text-xs text-muted-foreground">
                                {item.assetCode}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {item.category}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {(item.disposalMethod || "WRITE_OFF").replaceAll("_", " ")}
                              </Badge>
                            </TableCell>
                            <TableCell>{item.branch?.name || "-"}</TableCell>
                            <TableCell className="text-right font-mono">
                              {formatCurrency(Number(item.disposalAmount || 0))}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button size="sm" onClick={() => void approveDisposal(item.id)}>
                                  <CheckCircle2 className="mr-2 h-4 w-4" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive"
                                  onClick={() => void rejectDisposal(item.id)}
                                >
                                  <XCircle className="mr-2 h-4 w-4" />
                                  Reject
                                </Button>
                              </div>
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
      </Tabs>
    </div>
  );
}
