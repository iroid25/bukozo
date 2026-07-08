import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { LookupService } from "@/services/lookup.service";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const eligible = searchParams.get("eligible") === "true";

    if (eligible && user.role !== "ADMIN" && !user.branchId) {
      return NextResponse.json(
        {
          success: false,
          error: "You are not assigned to any branch. Contact administrator.",
        },
        { status: 403 }
      );
    }

    const result = eligible
      ? await LookupService.getEligibleInstitutionsForAccountCreation(
          user.role === "ADMIN" ? null : user.branchId ?? null
        )
      : await LookupService.getAllInstitutions();

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
