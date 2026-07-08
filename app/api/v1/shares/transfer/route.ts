
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { z } from "zod";
import { bumpAccountingSyncState } from "@/lib/services/accounting-sync";
import { assertMemberCanTransact } from "@/lib/member-transact-eligibility";
import { buildAccountBalanceUpdate } from "@/lib/accounting-rules";
import { SHARE_CAPITAL_CODE } from "@/lib/services/equity-structure";

const shareTransferSchema = z.object({
  sourceAccountId: z.string().min(1, "Source account is required"),
  targetMemberNumber: z.string().min(1, "Target member number is required"),
  numberOfShares: z.number().int().positive("Number of shares must be greater than 0"),
  notes: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { user } = session;
    const body = await request.json();

    const validation = shareTransferSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid data", details: validation.error.errors },
        { status: 400 }
      );
    }

    const { sourceAccountId, targetMemberNumber, numberOfShares, notes } = validation.data;

    // 1. Fetch Source Account
    const sourceAccount = await db.shareAccount.findUnique({
      where: { id: sourceAccountId },
      include: { 
        member: { include: { user: true } },
        accountType: true 
      }
    });

    if (!sourceAccount) {
      return NextResponse.json({ error: "Source account not found" }, { status: 404 });
    }

    if (sourceAccount.memberId) {
      try {
        await assertMemberCanTransact(sourceAccount.memberId);
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : "Source member is not eligible to transact yet" },
          { status: 400 },
        );
      }
    }

    // Role/Ownership Check
    // If not Admin/Manager, ensure user owns the source account
    const isStaff = ["ADMIN", "MANAGER", "ACCOUNTANT", "TELLER", "BRANCHMANAGER"].includes(user.role);
    if (!isStaff) {
         // Assuming member.userId links to User
         if (sourceAccount.member.userId !== user.id) {
             return NextResponse.json({ error: "Unauthorized to transfer from this account" }, { status: 403 });
         }
    }

    if (sourceAccount.numberOfShares < numberOfShares) {
      return NextResponse.json(
        { error: `Insufficient shares. Available: ${sourceAccount.numberOfShares}` },
        { status: 400 }
      );
    }

    // 2. Fetch Target Member and their Share Account
    const targetMember = await db.member.findUnique({
      where: { memberNumber: targetMemberNumber },
      include: {
        user: true,
        shareAccounts: {
          where: { status: "ACTIVE" },
          take: 1
        }
      }
    });

    if (!targetMember) {
      return NextResponse.json({ error: "Target member not found" }, { status: 404 });
    }

    try {
      await assertMemberCanTransact(targetMember.id);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Target member is not eligible to transact yet" },
        { status: 400 },
      );
    }

    if (targetMember.id === sourceAccount.memberId) {
      return NextResponse.json({ error: "Cannot transfer to the same member" }, { status: 400 });
    }

    const targetAccount = targetMember.shareAccounts[0];
    if (!targetAccount) {
      return NextResponse.json({ error: "Target member does not have an active share account" }, { status: 400 });
    }

    // 3. Perform Transfer
    const shareValue = sourceAccount.shareValue; 
    const transactionAmount = numberOfShares * shareValue;

    const result = await db.$transaction(async (tx) => {
      // Deduct from Source
      const updatedSource = await tx.shareAccount.update({
        where: { id: sourceAccount.id },
        data: {
          numberOfShares: { decrement: numberOfShares },
          totalValue: { decrement: transactionAmount }
        }
      });

      // Add to Target
      const updatedTarget = await tx.shareAccount.update({
        where: { id: targetAccount.id },
        data: {
          numberOfShares: { increment: numberOfShares },
          totalValue: { increment: transactionAmount }
        }
      });

      const reference = `TRF-${Date.now()}`;

      // Create Source Transaction (Transfer Out)
      await tx.shareTransaction.create({
        data: {
          accountId: sourceAccount.id,
          transactionType: "TRANSFER_OUT",
          shares: numberOfShares,
          shareValue: shareValue,
          amount: transactionAmount,
          sharesBefore: sourceAccount.numberOfShares,
          sharesAfter: updatedSource.numberOfShares,
          description: `Transfer to ${targetMember.memberNumber}: ${notes || ""}`,
          reference,
          tellerId: user.id,
        }
      });

      // Create Target Transaction (Transfer In)
      await tx.shareTransaction.create({
        data: {
          accountId: targetAccount.id,
          transactionType: "TRANSFER_IN",
          shares: numberOfShares,
          shareValue: shareValue,
          amount: transactionAmount,
          sharesBefore: targetAccount.numberOfShares,
          sharesAfter: updatedTarget.numberOfShares,
          description: `Transfer from ${sourceAccount.member.memberNumber}: ${notes || ""}`,
          reference,
          tellerId: user.id,
        }
      });
      
      // 5. Double-entry: Dr Share Capital (source decrease), Cr Share Capital (target increase)
      const shareCapitalGl = await tx.chartOfAccount.findFirst({
        where: { accountCode: SHARE_CAPITAL_CODE, isActive: true },
      });
      if (shareCapitalGl) {
        const jeRef = `JE-SHF-${reference}`;
        // Debit to decrease share capital liability for source member
        await tx.journalEntry.create({
          data: {
            entryNumber: jeRef, accountId: shareCapitalGl.id,
            debitAmount: transactionAmount, creditAmount: 0,
            description: `Share transfer out - ${sourceAccount.member.memberNumber} → ${targetMember.memberNumber}`,
            reference, entryDate: new Date(),
            branchId: sourceAccount.branchId,
            transactionId: null, createdByUserId: user.id,
          },
        });
        // Credit to increase share capital liability for target member
        await tx.journalEntry.create({
          data: {
            entryNumber: jeRef, accountId: shareCapitalGl.id,
            debitAmount: 0, creditAmount: transactionAmount,
            description: `Share transfer in - ${sourceAccount.member.memberNumber} → ${targetMember.memberNumber}`,
            reference, entryDate: new Date(),
            branchId: targetAccount.branchId || sourceAccount.branchId,
            transactionId: null, createdByUserId: user.id,
          },
        });
        await tx.chartOfAccount.update({
          where: { id: shareCapitalGl.id },
          data: buildAccountBalanceUpdate(shareCapitalGl, {
            debitAmount: transactionAmount,
            creditAmount: transactionAmount,
          }),
        });
      }

      // 6. Send Notifications
      if (sourceAccount.member.user?.id) {
        await tx.notification.create({
          data: {
            userId: sourceAccount.member.user.id,
            type: "IN_APP",
            subject: "Shares Transferred Out",
            message: `You have successfully transferred ${numberOfShares} shares from account ${sourceAccount.accountNumber} to ${targetMember.memberNumber}. Reference: ${reference}`,
            targetAddress: `/dashboard/accounts`,
            status: "SENT",
            sentAt: new Date()
          }
        });
      }

      if (targetMember.user?.id) {
        await tx.notification.create({
          data: {
            userId: targetMember.user.id,
            type: "IN_APP",
            subject: "Shares Transferred In",
            message: `You have received ${numberOfShares} shares into account ${targetAccount.accountNumber} from ${sourceAccount.member.memberNumber}. Reference: ${reference}`,
            targetAddress: `/dashboard/accounts`,
            status: "SENT",
            sentAt: new Date()
          }
        });
      }
      
      return { 
          source: updatedSource,
          target: updatedTarget,
          reference
      };
    });

    void bumpAccountingSyncState("Shares transferred");
    return NextResponse.json({ 
        success: true, 
        message: "Shares transferred successfully",
        data: result 
    }, { status: 201 });

  } catch (error) {
    console.error("Share transfer error:", error);
    return NextResponse.json(
      { error: "Failed to transfer shares" },
      { status: 500 }
    );
  }
}
