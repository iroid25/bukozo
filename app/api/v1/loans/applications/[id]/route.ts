import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { z } from "zod";

const updateLoanApplicationSchema = z.object({
  amountApplied: z.number().positive().optional(),
  purpose: z.string().optional(),
  loanProductId: z.string().optional(),
  interestType: z.enum(["FLAT_RATE", "REDUCING_BALANCE"]).optional(),
  // Add other updatable fields as needed
});

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const loanApplication = await db.loanApplication.findUnique({
      where: { id: params.id },
      include: {
        loanProduct: true,
        member: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                image: true,
              },
            },
            accounts: {
              where: { status: "ACTIVE" },
              include: {
                accountType: true,
                branch: true,
              },
            },
          },
        },
        approver: {
          select: {
            id: true,
            name: true,
            role: true,
            email: true,
          },
        },
        applicant: {
          select: {
            id: true,
            name: true,
            role: true,
            email: true,
          },
        },
        loanOfficer: {
          select: {
            id: true,
            name: true,
            role: true,
            email: true,
          },
        },
        loan: {
          include: {
            repayments: {
              orderBy: {
                repaymentDate: "desc",
              },
            },
            branch: true,
          },
        },
      },
    });

    if (!loanApplication) {
      return NextResponse.json(
        { error: "Loan application not found" },
        { status: 404 }
      );
    }

    // Check permissions (Admin, Staff, or Owner)
    const isStaff = [
      "ADMIN",
      "BRANCHMANAGER",
      "LOANOFFICER",
      "ACCOUNTANT",
    ].includes(session.user.role);
    const isOwner = loanApplication.member.user.id === session.user.id; // Assuming member has user relation

    // Wait, member.userId is the link.
    // Let's check if loanApplication.member.userId matches session.user.id
    // But I need to fetch member.userId. I included member.user, so I can check member.userId or member.user.id

    // Actually, loanApplication.memberId links to Member. Member has userId.
    // Let's check loanApplication.member.userId (which is implicitly available via relation if I select it, but I selected user object).
    // I can assume loanApplication.member.userId is available if I include it or just check via user object.
    // The query includes `member: { include: { user: ... } }`.
    // So `loanApplication.member.userId` should be accessible if I included it, or I can use `loanApplication.member.user.id` (since I included user).
    // Wait, `user` relation on `Member` uses `userId` FK.

    // Let's just use `loanApplication.member.userId` if it's in the result, but `findUnique` result type will have it.
    // However, to be safe, I'll rely on `loanApplication.member.userId` which is a field on Member.
    // I didn't explicitly select `userId` in `member` include, but `include` usually brings in all scalars unless `select` is used.
    // I used `include: { user: { select: ... } }` inside `member`.
    // Wait, if I use `include` on `member`, it includes all scalars of `member` PLUS the relations specified.
    // So `loanApplication.member.userId` should be there.

    // Correction: `loanApplication.member` is included. `include` on a relation includes all fields of that relation unless `select` is used.
    // I used `include: { user: ... }` inside `member`. So `member` fields are all included.

    const memberUserId = loanApplication.member.userId;

    if (!isStaff && session.user.id !== memberUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    return NextResponse.json(loanApplication);
  } catch (error) {
    console.error("Error fetching loan application:", error);
    return NextResponse.json(
      { error: "Failed to fetch loan application" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = updateLoanApplicationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid data", details: validation.error.errors },
        { status: 400 }
      );
    }

    const data = validation.data;

    const existingApplication = await db.loanApplication.findUnique({
      where: { id: params.id },
      include: { loanProduct: true, member: true },
    });

    if (!existingApplication) {
      return NextResponse.json(
        { error: "Loan application not found" },
        { status: 404 }
      );
    }

    // Check permissions: Only owner or staff can update?
    // Usually only owner can update details while pending. Staff might update some fields?
    // Let's assume owner or staff.
    const isStaff = ["ADMIN", "BRANCHMANAGER", "LOANOFFICER"].includes(
      session.user.role
    );
    const isOwner = existingApplication.member.userId === session.user.id;

    if (!isStaff && !isOwner) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (existingApplication.status !== "PENDING") {
      return NextResponse.json(
        { error: "Can only update pending loan applications" },
        { status: 400 }
      );
    }

    const updateData: any = {};

    if (data.purpose !== undefined) updateData.purpose = data.purpose;

    if (data.amountApplied !== undefined) {
      const loanProduct = existingApplication.loanProduct;
      if (
        data.amountApplied < loanProduct.minAmount ||
        data.amountApplied > loanProduct.maxAmount
      ) {
        return NextResponse.json(
          {
            error: `Loan amount must be between ${loanProduct.minAmount} and ${loanProduct.maxAmount}`,
          },
          { status: 400 }
        );
      }
      updateData.amountApplied = data.amountApplied;
    }

    if (data.loanProductId !== undefined) {
      const newLoanProduct = await db.loanProduct.findUnique({
        where: { id: data.loanProductId },
      });

      if (!newLoanProduct || !newLoanProduct.isActive) {
        return NextResponse.json(
          { error: "Selected loan product is not available" },
          { status: 400 }
        );
      }
      updateData.loanProductId = data.loanProductId;
    }

    if (data.interestType !== undefined) {
      updateData.interestType = data.interestType;
    }

    const updatedApplication = await db.loanApplication.update({
      where: { id: params.id },
      data: updateData,
      include: {
        loanProduct: true,
        member: {
          include: {
            user: true,
          },
        },
      },
    });

    return NextResponse.json(updatedApplication);
  } catch (error) {
    console.error("Error updating loan application:", error);
    return NextResponse.json(
      { error: "Failed to update loan application" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isStaff = ["ADMIN", "BRANCHMANAGER"].includes(session.user.role);

    const application = await db.loanApplication.findUnique({
      where: { id: params.id },
      include: { member: { select: { userId: true } } },
    });

    if (!application) {
      return NextResponse.json({ error: "Loan application not found" }, { status: 404 });
    }

    const isOwner = application.member.userId === session.user.id;
    if (!isStaff && !isOwner) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (application.status !== "PENDING") {
      return NextResponse.json(
        { error: "Only pending applications can be deleted" },
        { status: 400 }
      );
    }

    await db.loanApplication.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true, message: "Application deleted" });
  } catch (error) {
    console.error("Error deleting loan application:", error);
    return NextResponse.json(
      { error: "Failed to delete loan application" },
      { status: 500 }
    );
  }
}
