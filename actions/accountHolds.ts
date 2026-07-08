"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/prisma/db";
import { HoldReason } from "@prisma/client";
import { createAuditLog } from "@/lib/lib/auditLog";

// -----------------------------
// DTOs
// -----------------------------
export interface PlaceHoldDTO {
  accountId: string;
  reason: HoldReason;
  reasonText?: string;
  loanId?: string; // Optional, link to defaulted loan
  memberId?: string; // Optional, usually derived from account
  institutionId?: string; 
  placedByUserId: string;
  notes?: string;
}

export interface LiftHoldDTO {
  holdId: string;
  liftedByUserId: string;
  liftNotes?: string;
}

// -----------------------------
// Actions
// -----------------------------

export async function placeAccountHold(data: PlaceHoldDTO) {
  try {
    // 1. Validate Account
    const account = await db.account.findUnique({
      where: { id: data.accountId },
      include: {
        member: true,
        institution: true,
        accountHolds: { where: { isActive: true } }
      }
    });

    if (!account) return { error: "Account not found" };
    if (account.accountHolds.length > 0) {
      return { error: "Account is already on hold." };
    }

    // Ensure we have a memberId (either from account or provided in data)
    const memberId = account.memberId || data.memberId;
    if (!memberId) {
      return { error: "Account must be associated with a member to place a hold." };
    }

    // 2. Create Hold
    const hold = await db.accountHold.create({
      data: {
        accountId: data.accountId,
        memberId: memberId,
        institutionId: account.institutionId,
        reason: data.reason,
        reasonText: data.reasonText,
        loanId: data.loanId,
        placedByUserId: data.placedByUserId,
        notes: data.notes,
        isActive: true,
      }
    });

    // 3. Audit Log
    await createAuditLog({
      userId: data.placedByUserId,
      action: "ACCOUNT_HOLD_PLACED",
      entityType: "AccountHold",
      entityId: hold.id,
      newValue: { ...data, holdId: hold.id },
      details: `Placed ${data.reason} hold on account ${account.accountNumber}. Reason: ${data.reasonText || 'None'}`
    });

    revalidatePath("/dashboard/accounts");
    revalidatePath(`/dashboard/accounts/${data.accountId}`);

    return { success: true, data: hold };

  } catch (error) {
    console.error("Error placing hold:", error);
    return { error: "Failed to place account hold" };
  }
}

export async function liftAccountHold(data: LiftHoldDTO) {
  try {
    const hold = await db.accountHold.findUnique({
      where: { id: data.holdId },
      include: { account: true }
    });

    if (!hold) return { error: "Hold not found" };
    if (!hold.isActive) return { error: "Hold is already lifted" };

    const updatedHold = await db.accountHold.update({
      where: { id: data.holdId },
      data: {
        isActive: false,
        liftedAt: new Date(),
        liftedByUserId: data.liftedByUserId,
        liftNotes: data.liftNotes
      }
    });

    await createAuditLog({
      userId: data.liftedByUserId,
      action: "ACCOUNT_HOLD_LIFTED",
      entityType: "AccountHold",
      entityId: hold.id,
      details: `Lifted hold on account ${hold.account.accountNumber}. Notes: ${data.liftNotes || 'None'}`
    });

    revalidatePath("/dashboard/accounts");
    revalidatePath(`/dashboard/accounts/${hold.accountId}`);

    return { success: true, data: updatedHold };

  } catch (error) {
    console.error("Error lifting hold:", error);
    return { error: "Failed to lift account hold" };
  }
}

export async function getActiveHolds() {
  const MAX_RETRIES = 3;
  let retryCount = 0;

  while (retryCount < MAX_RETRIES) {
    try {
      const holds = await db.accountHold.findMany({
        where: { isActive: true },
        include: {
          account: {
            include: {
              accountType: true
            }
          },
          member: {
            include: {
               user: true
            }
          },
          institution: {
            include: {
               user: true
            }
          },
          placedBy: true,
          liftedBy: true,
          loan: true
        },
        orderBy: { placedAt: "desc" }
      });
      return { success: true, data: holds };
    } catch (error: any) {
      retryCount++;
      console.error(`Attempt ${retryCount} failed to fetch holds:`, error.message);
      
      if (retryCount >= MAX_RETRIES) {
        return { error: `Failed to fetch active holds after ${MAX_RETRIES} attempts. Please try again later.`, data: [] };
      }
      
      // Wait before retrying (exponential backoff: 500ms, 1000ms, etc.)
      await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, retryCount - 1)));
    }
  }
  
  return { error: "Failed to fetch active holds: Unknown error during retry.", data: [] };
}

