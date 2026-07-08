import { NextRequest } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { successResponse, ApiErrors } from "@/lib/api-utils";
import { loanOfficerPerformanceService } from "@/services/analytics/loan-officer-performance.service";

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return ApiErrors.unauthorized();
    }

    // Only admins and managers can view analytics
    if (!["ADMIN", "MANAGER", "BRANCHMANAGER"].includes(user.role)) {
      return ApiErrors.forbidden("You don't have permission to view analytics");
    }

    const { searchParams } = new URL(req.url);
    const officerId = searchParams.get("officerId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const top = searchParams.get("top");

    const dateRange = {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    };

    // Get specific officer performance
    if (officerId) {
      const performance = await loanOfficerPerformanceService.getOfficerPerformance(
        officerId,
        dateRange
      );
      return successResponse(performance);
    }

    // Get top performers
    if (top) {
      const topPerformers = await loanOfficerPerformanceService.getTopPerformers(
        parseInt(top),
        dateRange
      );
      return successResponse(topPerformers);
    }

    // Get all officers performance
    const allPerformance = await loanOfficerPerformanceService.getAllOfficersPerformance(dateRange);
    return successResponse(allPerformance);
  } catch (error: any) {
    console.error("Error fetching loan officer performance:", error);
    return ApiErrors.internalError(error.message);
  }
}
