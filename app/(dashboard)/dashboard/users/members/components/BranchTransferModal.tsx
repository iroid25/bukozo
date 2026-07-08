"use client";

import { useState } from "react";
import { ArrowRightLeft, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface BranchTransferModalProps {
  open: boolean;
  member: any;
  branches: any[];
  onClose: () => void;
}

export default function BranchTransferModal({
  open,
  member,
  branches,
  onClose,
}: BranchTransferModalProps) {
  const router = useRouter();
  const [targetBranchId, setTargetBranchId] = useState("");
  const [notes, setNotes] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);

  if (!open || !member) return null;

  const memberId = member.member?.id || member.id;
  const name = member.name || "Unknown";
  const memberNumber = member.member?.memberNumber || member.memberNumber || "";
  const currentBranchId = member.branchId;
  const currentBranchName = member.branch?.name || "N/A";
  const availableBranches = branches.filter(
    (b: any) => b.id !== currentBranchId
  );

  const handleTransfer = async () => {
    if (!targetBranchId) {
      toast.error("Please select a target branch");
      return;
    }

    setIsTransferring(true);
    try {
      const res = await fetch(
        `/api/v1/members/${memberId}/transfer-branch`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetBranchId,
            transferNotes: notes || undefined,
          }),
        }
      );

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Transfer failed");
      }

      toast.success(result.message || "Member transferred successfully");
      setTargetBranchId("");
      setNotes("");
      router.refresh();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to transfer member");
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-blue-600" />
            Transfer Member Branch
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <p className="text-sm text-slate-500">
            Move <strong>{name}</strong>
            {memberNumber ? ` (${memberNumber})` : ""} to a different branch.
          </p>

          <div className="rounded-lg border bg-slate-50 px-4 py-3">
            <p className="text-xs uppercase tracking-widest text-slate-500">
              Current Branch
            </p>
            <p className="mt-0.5 font-semibold text-slate-900">
              {currentBranchName}
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              Transfer To Branch <span className="text-red-500">*</span>
            </label>
            <select
              value={targetBranchId}
              onChange={(e) => setTargetBranchId(e.target.value)}
              className="block w-full rounded-md border-0 py-2 pl-3 pr-8 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-500 sm:text-sm sm:leading-6"
            >
              <option value="">Select branch...</option>
              {availableBranches.map((b: any) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                  {b.location ? ` — ${b.location}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              Transfer Notes{" "}
              <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              className="block w-full rounded-md border-0 py-2 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-500 sm:text-sm sm:leading-6 resize-none"
              rows={3}
              placeholder="Reason for transfer..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-2 px-6 pb-6">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onClose}
            disabled={isTransferring}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            onClick={handleTransfer}
            disabled={isTransferring || !targetBranchId}
          >
            {isTransferring && (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            )}
            Confirm Transfer
          </Button>
        </div>
      </div>
    </div>
  );
}
