import { Metadata } from "next";
import DisbursementQueueClient from "./DisbursementQueueClient";

export const metadata: Metadata = {
  title: "Disbursement Queue | Loan Process",
  description: "Track and disburse loans assigned to you",
};

export default async function DisbursementQueuePage() {
  return <DisbursementQueueClient />;
}
