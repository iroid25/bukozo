// @ts-nocheck
"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import LoanApplicationCreateForm from "@/app/(dashboard)/dashboard/loan-applications/components/LoanApplicationCreateForm";
export default function OfficerLoansPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [apps, setApps] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [me, setMe] = useState<any>(null);

  const loadQueue = async () => {
    const res = await fetch("/api/v1/loans/applications/officer-queue");
    const json = await res.json();
    setApps(json.data || []);
  };

  useEffect(() => {
    setMe(session?.user || null);
    loadQueue();
  }, [session]);

  async function markAnalysis(id: string) {
    await fetch(`/api/v1/loans/applications/${id}/analyze`, { method: "POST" });
    loadQueue();
  }
  async function forward(id: string) {
    await fetch(`/api/v1/loans/applications/${id}/forward`, { method: "POST" });
    loadQueue();
  }
  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Loan Officer – Applications</h1>
        <Button onClick={() => setModalOpen(true)}>New Application</Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>In Process</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {apps.map((a) => (
              <div
                key={a.id}
                className="py-3 flex items-center justify-between"
              >
                <div>
                  <div className="font-medium">
                    {a.member.user?.name || a.memberId}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {a.loanProduct.name} • UGX{" "}
                    {a.amountApplied.toLocaleString()} • Stage: {a.stage}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => markAnalysis(a.id)}>
                    Mark In Analysis
                  </Button>
                  <Button onClick={() => forward(a.id)}>
                    Forward to Manager
                  </Button>
                </div>
              </div>
            ))}
            {apps.length === 0 && (
              <div className="text-sm text-muted-foreground py-6">
                No applications in process.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Loan Application</DialogTitle>
          </DialogHeader>
          {me?.id ? (
            <LoanApplicationCreateForm
              currentUserId={me.id}
              onSuccess={async () => {
                toast.success("Application submitted");
                setModalOpen(false);
                setApps(await listOfficerQueue(me.id));
              }}
            />
          ) : (
            <div className="text-sm text-muted-foreground">
              Loading officer profile...
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
