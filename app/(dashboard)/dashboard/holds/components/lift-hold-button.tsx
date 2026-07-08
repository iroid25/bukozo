"use client";

import { useState } from "react";
import { Loader2, Unlock } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";


interface LiftHoldButtonProps {
  holdId: string;
  userId: string;
  accountNumber: string;
  onSuccess?: () => void;
}

export function LiftHoldButton({ holdId, userId, accountNumber, onSuccess }: LiftHoldButtonProps) {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");

  async function handleLift() {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/holds/${holdId}/lift`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liftNotes: notes }),
      });
      const result = await res.json();

      if (!res.ok) {
        toast.error(result.error || "Failed to lift hold");
        return;
      }

      toast.success("Hold lifted successfully");
      setOpen(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      toast.error("Failed to lift hold");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800">
          <Unlock className="mr-2 h-3 w-3" />
          Lift
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Lift Hold?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to lift the hold on account {accountNumber}?
            This will allow withdrawals again.
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="grid gap-4 py-4">
            <div className="grid gap-2">
                <Label htmlFor="lift-notes">Reason for lifting (Optional)</Label>
                <Input 
                    id="lift-notes" 
                    value={notes} 
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="E.g., Debt cleared"
                />
            </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction 
            onClick={(e) => {
                e.preventDefault();
                handleLift();
            }}
            disabled={loading}
            className="bg-green-600 hover:bg-green-700"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm Lift
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
