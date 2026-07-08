import { NextRequest } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { successResponse, ApiErrors } from "@/lib/api-utils";
import { tellerPerformanceService } from "@/services/analytics/teller-performance.service";

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
    const tellerId = searchParams.get("tellerId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const top = searchParams.get("top");

    const dateRange = {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    };

    // Get specific teller performance
    if (tellerId) {
      const performance = await tellerPerformanceService.getTellerPerformance(tellerId, dateRange);
      return successResponse(performance);
    }

    // Get top performers
    if (top) {
      const topPerformers = await tellerPerformanceService.getTopPerformers(parseInt(top), dateRange);
      return successResponse(topPerformers);
    }

    // Get all tellers performance
    const allPerformance = await tellerPerformanceService.getAllTellersPerformance(dateRange);
    return successResponse(allPerformance);
  } catch (error: any) {
    console.error("Error fetching teller performance:", error);
    return ApiErrors.internalError(error.message);
  }
}
