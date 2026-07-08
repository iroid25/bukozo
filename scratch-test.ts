import { getFinancialDashboardSummary, getFinancialDashboardTrends } from "./lib/services/financial-dashboard-reports";

async function main() {
  try {
    const user = { id: "test-user-id", role: "ADMIN", branchId: null };
    console.log("Testing dashboard summary...");
    const summary = await getFinancialDashboardSummary(user);
    console.log("Summary success:", summary);

    console.log("Testing dashboard trends...");
    const trends = await getFinancialDashboardTrends(user);
    console.log("Trends success:", trends.length, "months");
  } catch (error) {
    console.error("Error occurred:");
    console.error(error);
  }
}

main().catch(console.error);
