import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { calculateLoanSchedule } from "@/lib/loan-calculations";

/**
 * POST /api/v1/loans/schedule/preview
 * Calculate loan schedule based on provided parameters (Stateless)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await request.json();
    const {
      amount,
      interestRate,
      periodMonths,
      gracePeriod,
      interestType,
      startDate,
      interestPeriod,
      scheduleFrequency = "MONTHLY",
    } = body;

    if (!amount || !interestRate || !periodMonths) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Missing required parameters: amount, interestRate, periodMonths",
        },
        { status: 400 },
      );
    }

    const scheduleResult = calculateLoanSchedule({
      amountGranted: Number(amount),
      interestRate: Number(interestRate),
      repaymentPeriodMonths: Number(periodMonths),
      interestType: (interestType || "FLAT_RATE") as
        | "FLAT_RATE"
        | "REDUCING_BALANCE",
      gracePeriod: Number(gracePeriod || 0),
      disbursementDate: startDate ? new Date(startDate) : new Date(),
      interestPeriod: (interestPeriod || "MONTHLY") as "MONTHLY" | "ANNUAL",
      scheduleFrequency: scheduleFrequency as any,
    });

    return NextResponse.json({
      success: true,
      data: {
        ...scheduleResult,
      },
    });
  } catch (error) {
    console.error("Error calculating schedule preview:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
