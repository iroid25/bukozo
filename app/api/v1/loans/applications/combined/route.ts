import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { LoanService } from "@/services/loan.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { role, branchId, id: userId } = session.user as any;

    const individualWhere: any = {};
    const institutionWhere: any = {};

    if (role === "MEMBER") {
      const member = await db.member.findUnique({ where: { userId } });
      if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });
      individualWhere.memberId = member.id;
      institutionWhere.id = "none";
    } else if (role === "INSTITUTION") {
      const inst = await db.institution.findUnique({ where: { userId } });
      if (!inst) return NextResponse.json({ error: "Institution not found" }, { status: 404 });
      institutionWhere.institutionId = inst.id;
      individualWhere.id = "none";
    } else if (["TELLER", "LOANOFFICER"].includes(role)) {
      // Filter by assignment only — the assignment itself already scopes to this staff member
      individualWhere.OR = [
        { applicantId: userId },
        { loanOfficerId: userId },
        { allocatedTellerId: userId },
      ];
      institutionWhere.OR = [
        { applicantUserId: userId },
        { loanOfficerId: userId },
        { allocatedTellerId: userId },
      ];
    } else if (["BRANCHMANAGER", "ACCOUNTANT"].includes(role) && branchId) {
      individualWhere.member = { user: { branchId } };
      institutionWhere.institution = { user: { branchId } };
    }

    const [individualApps, institutionalApps, products, statsResult] = await Promise.all([
      db.loanApplication.findMany({
        where: individualWhere,
        take: 100,
        include: {
          loanProduct: true,
          member: {
            include: {
              user: { select: { name: true, email: true, phone: true, image: true } },
              accounts: {
                where: { status: "ACTIVE" },
                take: 1,
                orderBy: { openedAt: "asc" },
                select: { id: true, accountNumber: true, balance: true },
              },
            },
          },
          approver: { select: { id: true, name: true, role: true } },
          applicant: { select: { id: true, name: true, role: true } },
          loanOfficer: { select: { id: true, name: true, role: true } },
          allocatedTeller: { select: { id: true, name: true, role: true } },
          loan: { select: { id: true, outstandingBalance: true, amountGranted: true, totalAmountDue: true, disbursementDate: true, dueDate: true } },
        },
        orderBy: { applicationDate: "desc" },
      }),
      db.institutionLoanApplication.findMany({
        where: institutionWhere,
        take: 100,
        include: {
          loanProduct: true,
          institution: {
            include: {
              user: { select: { name: true, email: true, phone: true, image: true } },
            },
          },
          loanOfficer: { select: { id: true, name: true, role: true } },
          allocatedTeller: { select: { id: true, name: true, role: true } },
          institutionLoan: { select: { id: true, outstandingBalance: true } },
        },
        orderBy: { applicationDate: "desc" },
      }),
      db.loanProduct.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
      }),
      LoanService.getApplicationStatistics({
        branchId: ["TELLER", "LOANOFFICER", "BRANCHMANAGER"].includes(role) ? branchId : undefined,
        officerId: ["TELLER", "LOANOFFICER"].includes(role) ? userId : undefined,
      }),
    ]);

    const formattedIndividual = individualApps.map((app: any) => ({
      ...app,
      isInstitution: false,
      member: { ...app.member, account: app.member?.accounts?.[0] || null },
    }));

    const formattedInstitutional = institutionalApps.map((app: any) => ({
      ...app,
      isInstitution: true,
      applicationType: "INSTITUTION",
      organizationName: app.institution?.institutionName || "Unknown Institution",
      organizationType: app.institution?.institutionType || "N/A",
      district: app.institution?.district || "N/A",
      mobileNumber: app.institution?.institutionPhone || "N/A",
      emailAddress: app.institution?.institutionEmail || "",
      member: {
        user: {
          id: app.institution?.userId || "N/A",
          name: app.institution?.institutionName || "Unknown Institution",
          email: app.institution?.institutionEmail || "",
          phone: app.institution?.institutionPhone || "",
          image: null,
        },
        memberNumber: app.institution?.institutionNumber || "N/A",
        account: null,
      },
      loan: app.institutionLoan || null,
    }));

    const applications = [...formattedIndividual, ...formattedInstitutional].sort(
      (a: any, b: any) =>
        new Date(b.applicationDate).getTime() - new Date(a.applicationDate).getTime()
    );

    const statistics = statsResult.ok
      ? statsResult.data
      : { pending: 0, approved: 0, rejected: 0, disbursed: 0, underReview: 0, totalAmount: 0 };

    return NextResponse.json({ success: true, data: { applications, products, statistics } });
  } catch (error: any) {
    console.error("Error fetching combined loan applications:", error);
    return NextResponse.json({ error: "Failed to fetch applications" }, { status: 500 });
  }
}
