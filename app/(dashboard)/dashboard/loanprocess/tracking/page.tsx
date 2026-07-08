// @ts-nocheck
"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function MemberLoanTracking() {
  const { data: session } = useSession();
  const [apps, setApps] = useState<any[]>([]);
  const [me, setMe] = useState<any>(null);
  const [appealOpen, setAppealOpen] = useState(false);
  const [appealText, setAppealText] = useState("");
  const [selected, setSelected] = useState<any>(null);

  const loadApps = async (memberId: string) => {
    const res = await fetch(`/api/v1/loans/applications/member-tracker?memberId=${memberId}`);
    const json = await res.json();
    setApps(json.data || []);
  };

  useEffect(() => {
    (async () => {
      const response = await fetch("/api/v1/members/me");
      const json = await response.json();
      const member = json?.data || null;
      setMe(member);
      if (member?.member?.id) loadApps(member.member.id);
    })();
  }, [session]);

  async function submitAppeal() {
    await fetch("/api/v1/loans/appeals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: me.member.id, applicationId: selected.id, reason: appealText }),
    });
    setAppealOpen(false);
    loadApps(me.member.id);
  }
  return (
    <div className="p-4 space-y-6">
      <h1 className="text-2xl font-bold">My Loan Applications</h1>
      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
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
                    {a.loanProduct.name} • UGX{" "}
                    {a.amountApplied.toLocaleString()}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Stage: {a.stage}{" "}
                    {a.rejectionReason && `(Rejected: ${a.rejectionReason})`}
                  </div>
                </div>
                {a.stage === "REJECTED" && (
                  <Button
                    onClick={() => {
                      setSelected(a);
                      setAppealOpen(true);
                    }}
                  >
                    Submit Appeal
                  </Button>
                )}
              </div>
            ))}
            {apps.length === 0 && (
              <div className="text-sm text-muted-foreground py-6">
                No applications yet.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      <Dialog open={appealOpen} onOpenChange={setAppealOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Appeal Rejection</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Why should this be reconsidered?"
              value={appealText}
              onChange={(e) => setAppealText(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAppealOpen(false)}>
                Cancel
              </Button>
              <Button onClick={submitAppeal}>Submit</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
