// ============================================
// FILE: components/reconciliation/ReconciliationTable.tsx
// ============================================
import type { Reconciliation } from "@/types/reconciliation";
import { ReconciliationTableRow } from "./ReconciliationTableRow";

interface ReconciliationTableProps {
  data: Reconciliation[];
  type: "pending" | "approved" | "rejected";
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}

export function ReconciliationTable({
  data,
  type,
  onApprove,
  onReject,
}: ReconciliationTableProps) {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No {type} reconciliations
      </div>
    );
  }

  const showActions = type === "pending";
  const showApprovalInfo = type === "approved" || type === "rejected";
  const showRejectionReason = type === "rejected";

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
              Teller
            </th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
              {showApprovalInfo ? "Reconciliation Date" : "Date"}
            </th>
            {showApprovalInfo && (
              <>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  {type === "approved" ? "Approved Date" : "Rejected Date"}
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  {type === "approved" ? "Approved By" : "Rejected By"}
                </th>
              </>
            )}
            <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">
              System Balance
            </th>
            <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">
              Actual Cash
            </th>
            <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">
              Variance
            </th>
            {showRejectionReason && (
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                Rejection Reason
              </th>
            )}
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
              Status
            </th>
            {showActions && (
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y">
          {data.map((rec) => (
            <ReconciliationTableRow
              key={rec.id}
              reconciliation={rec}
              showActions={showActions}
              showApprovalInfo={showApprovalInfo}
              showRejectionReason={showRejectionReason}
              onApprove={onApprove}
              onReject={onReject}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
