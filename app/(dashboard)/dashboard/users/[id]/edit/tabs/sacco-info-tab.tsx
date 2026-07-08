"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

import { Member } from "@/types/member";

export function SaccoInfoTab({ item }: { item: Member & { user: any } }) {
  return (
    <div className="grid gap-6 mt-6">
      <CertificationCard item={item} />
      <WithdrawalInstructionsCard item={item} />
    </div>
  );
}

function CertificationCard({ item }: { item: Member & { user: any } }) {
  const [certifiedBy, setCertifiedBy] = useState(item.certifiedBy || "");
  const [certifierAccountNo, setCertifierAccountNo] = useState(
    item.certifierAccountNo || ""
  );
  const [certifierPhone, setCertifierPhone] = useState(
    item.certifierPhone || ""
  );
  const [certificationDate, setCertificationDate] = useState(
    item.certificationDate
      ? new Date(item.certificationDate).toISOString().split("T")[0]
      : ""
  );
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdate = async () => {
    setIsUpdating(true);

    try {
      const data = {
        certifiedBy: certifiedBy || undefined,
        certifierAccountNo: certifierAccountNo || undefined,
        certifierPhone: certifierPhone || undefined,
        certificationDate: certificationDate
          ? new Date(certificationDate)
          : undefined,
      };

      const _res = await fetch(`/api/v1/members/${item.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); if (!_res.ok) { const _json = await _res.json(); throw new Error(_json.error || "Update failed"); }
      toast.success("Certification information updated successfully");
    } catch (error) {
      toast.error("Failed to update certification information");
      console.error(error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>SACCO Certification</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="grid gap-3">
            <Label htmlFor="certifiedBy">Certified by (Name)</Label>
            <Input
              id="certifiedBy"
              value={certifiedBy}
              onChange={(e) => setCertifiedBy(e.target.value)}
              placeholder="Name of certifying member"
            />
          </div>

          <div className="grid gap-3">
            <Label htmlFor="certifierAccountNo">Certifier's Account No.</Label>
            <Input
              id="certifierAccountNo"
              value={certifierAccountNo}
              onChange={(e) => setCertifierAccountNo(e.target.value)}
              placeholder="Account number"
            />
          </div>

          <div className="grid gap-3">
            <Label htmlFor="certifierPhone">Certifier's Phone</Label>
            <Input
              id="certifierPhone"
              type="tel"
              value={certifierPhone}
              onChange={(e) => setCertifierPhone(e.target.value)}
              placeholder="Phone number"
            />
          </div>

          <div className="grid gap-3">
            <Label htmlFor="certificationDate">Certification Date</Label>
            <Input
              id="certificationDate"
              type="date"
              value={certificationDate}
              onChange={(e) => setCertificationDate(e.target.value)}
            />
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-800 mb-2">
            Certification Requirements:
          </h4>
          <p className="text-sm text-blue-700">
            A current SACCO member must certify that they know the applicant and
            can vouch for their character and eligibility to join the SACCO.
          </p>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleUpdate} disabled={isUpdating}>
          {isUpdating ? "Updating..." : "Update Certification Information"}
        </Button>
      </CardFooter>
    </Card>
  );
}

function WithdrawalInstructionsCard({
  item,
}: {
  item: Member & { user: any };
}) {
  const [withdrawalInstructions, setWithdrawalInstructions] = useState(
    item.withdrawalInstructions || ""
  );
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdate = async () => {
    setIsUpdating(true);

    try {
      const data = {
        withdrawalInstructions: withdrawalInstructions || undefined,
      };

      const _res = await fetch(`/api/v1/members/${item.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); if (!_res.ok) { const _json = await _res.json(); throw new Error(_json.error || "Update failed"); }
      toast.success("Withdrawal instructions updated successfully");
    } catch (error) {
      toast.error("Failed to update withdrawal instructions");
      console.error(error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Withdrawal Instructions</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6">
        <div className="grid gap-3">
          <Label htmlFor="withdrawalInstructions">
            Authorization for Withdrawals
          </Label>
          <Textarea
            id="withdrawalInstructions"
            value={withdrawalInstructions}
            onChange={(e) => setWithdrawalInstructions(e.target.value)}
            placeholder="Any withdrawal of funds from this account will only be authorized by..."
            rows={4}
          />
          <p className="text-sm text-muted-foreground">
            Specify who is authorized to make withdrawals from your account.
          </p>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleUpdate} disabled={isUpdating}>
          {isUpdating ? "Updating..." : "Update Withdrawal Instructions"}
        </Button>
      </CardFooter>
    </Card>
  );
}
