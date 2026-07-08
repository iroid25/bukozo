import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { LookupService } from "@/services/lookup.service";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const all = searchParams.get("all") === "true";

    const result = all 
        ? await LookupService.getAllMembers()
        : await LookupService.getMembersWithActiveAccounts();

    if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: 400 });

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
