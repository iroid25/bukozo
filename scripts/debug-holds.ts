
import { getActiveHolds } from "@/actions/accountHolds";

async function main() {
  console.log("Fetching active holds...");
  const result = await getActiveHolds();
  
  if (result.error) {
    console.error("Error fetching holds:", result.error);
  } else {
    console.log("Successfully fetched holds:", JSON.stringify(result.data, null, 2));
  }
}

main()
  .catch((e) => console.error("Script error:", e))
  .finally(() => process.exit());
