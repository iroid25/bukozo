// ============================================
// FILE: components/reconciliation/ReconciliationTableRow.tsx
// ============================================
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Clock } from "lucide-react";
import type {
  Reconciliation,
  FullReconciliation,
  ReconciliationWithUser,
} from "@/types/reconciliation";
import {
  isReconciliationWithUser,
  isFullReconciliation,
} from "@/types/reconciliation";
import {
  formatCurrency,
  getVarianceStatus,
  formatDateSafe,
} from "@/lib/lib/reconciliation-utils";

interface ReconciliationTableRowProps {
  reconciliation: Reconciliation | FullReconciliation | ReconciliationWithUser;
  showActions?: boolean;
  showApprovalInfo?: boolean;
  showRejectionReason?: boolean;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}

export function ReconciliationTableRow({
  reconciliation,
  showActions = false,
  showApprovalInfo = false,
  showRejectionReason = false,
  onApprove,
  onReject,
}: ReconciliationTableRowProps) {
  const variance = Number(reconciliation.difference) || 0;
  const varianceStatus = getVarianceStatus(variance);

  // Safely get teller info
  const tellerName = isReconciliationWithUser(reconciliation)
    ? reconciliation.float?.user?.name || "Unknown"
    : "Unknown";

  const tellerRole = isReconciliationWithUser(reconciliation)
    ? reconciliation.float?.user?.role || "N/A"
    : "N/A";

  // Safely get approver info
  const approverName = isFullReconciliation(reconciliation)
    ? reconciliation.approvedBy?.name || "-"
    : "-";

  return (
    <tr className="hover:bg-gray-50">
      {/* Teller Info */}
      <td className="px-6 py-4">
        <div>
          <div className="font-medium text-gray-900">{tellerName}</div>
          <div className="text-sm text-gray-500">{tellerRole}</div>
        </div>
      </td>

      {/* Reconciliation Date */}
      <td className="px-6 py-4 text-sm text-gray-900">
        {reconciliation.reconciliationDate
          ? new Date(reconciliation.reconciliationDate).toLocaleDateString()
          : "-"}
      </td>

      {/* Approval Info (for processed reconciliations) */}
      {showApprovalInfo && (
        <>
          <td className="px-6 py-4 text-sm text-gray-900">
            {reconciliation.approvalDate
              ? new Date(reconciliation.approvalDate).toLocaleDateString()
              : "-"}
          </td>
          <td className="px-6 py-4 text-sm text-gray-900">{approverName}</td>
        </>
      )}

      {/* Financial Columns */}
      <td className="px-6 py-4 text-right text-sm text-gray-900">
        {formatCurrency(reconciliation.systemBalance)}
      </td>
      <td className="px-6 py-4 text-right text-sm text-gray-900">
        {formatCurrency(reconciliation.actualCash)}
      </td>
      <td
        className={`px-6 py-4 text-right text-sm font-semibold ${varianceStatus.color}`}
      >
        {variance >= 0 ? "+" : ""}
        {formatCurrency(variance)}
      </td>

      {/* Rejection Reason / Notes */}
      {showRejectionReason && (
        <td
          className="px-6 py-4 text-sm max-w-xs truncate"
          title={reconciliation.rejectionReason || reconciliation.notes || ""}
        >
          {reconciliation.rejectionReason || reconciliation.notes || "-"}
        </td>
      )}

      {/* Status Badge */}
      <td className="px-6 py-4">
        {reconciliation.status === "PENDING" && (
          <Badge className="bg-yellow-100 text-yellow-700">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        )}
        {reconciliation.status === "APPROVED" && (
          <Badge className="bg-green-100 text-green-700">
            <CheckCircle className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        )}
        {reconciliation.status === "REJECTED" && (
          <Badge className="bg-red-100 text-red-700">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        )}
      </td>

      {/* Actions */}
      {showActions && (
        <td className="px-6 py-4">
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => onApprove?.(reconciliation.id)}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => onReject?.(reconciliation.id)}
            >
              <XCircle className="h-4 w-4 mr-1" />
              Reject
            </Button>
          </div>
        </td>
      )}
    </tr>
  );
}
