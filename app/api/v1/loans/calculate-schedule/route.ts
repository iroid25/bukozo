import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { calculateLoanSchedule } from "@/lib/loan-calculations";

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await req.json();
    const {
      principal,
      ratePercent,
      periodMonths,
      interestType,
      gracePeriodDays = 0,
      startDate = new Date(),
      interestPeriod = "MONTHLY",
      payments = [],
      scheduleFrequency = "MONTHLY",
    } = body;

    // Validate required fields
    if (!principal || !ratePercent || !periodMonths || !interestType) {
      return NextResponse.json(
        { success: false, error: "Missing required calculation parameters" },
        { status: 400 },
      );
    }

    // Convert string dates back to Date objects for the payments array
    const parsedPayments = payments.map((p: any) => ({
      ...p,
      paymentDate: new Date(p.paymentDate),
    }));

    const result = calculateLoanSchedule({
      amountGranted: Number(principal),
      interestRate: Number(ratePercent),
      repaymentPeriodMonths: Number(periodMonths),
      interestType: interestType as "FLAT_RATE" | "REDUCING_BALANCE",
      gracePeriod: Number(gracePeriodDays),
      disbursementDate: new Date(startDate),
      interestPeriod: interestPeriod as "MONTHLY" | "ANNUAL",
      payments: parsedPayments,
      scheduleFrequency: scheduleFrequency as any,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Error calculating loan schedule:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal Server Error",
      },
      { status: 500 },
    );
  }
}
