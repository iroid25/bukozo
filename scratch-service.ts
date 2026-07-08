import { getFinancialDashboardSummary, getFinancialDashboardTrends } from "./lib/services/financial-dashboard-reports";
import { db } from "./prisma/db";

async function main() {
  try {
    console.log("Starting service test...");
    const user = { id: "test", role: "ADMIN" } as any;

    console.log("Calling getFinancialDashboardSummary...");
    const summary = await getFinancialDashboardSummary(user);
    console.log("Summary:", summary);

    console.log("Calling getFinancialDashboardTrends...");
    const trends = await getFinancialDashboardTrends(user);
    console.log("Trends length:", trends.length);

  } catch (error) {
    console.error("SERVICE ERROR:", error);
  } finally {
    await db.$disconnect();
  }
}

main().catch(console.error);
