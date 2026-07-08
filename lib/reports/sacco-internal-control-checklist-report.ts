import { db } from "@/prisma/db";
import { resolveBranchScope } from "@/lib/services/branch-scope";
import {
  EMPTY_SACCO_INTERNAL_CONTROL_CHECKLIST_SUMMARY,
  SACCO_INTERNAL_CONTROL_CHECKLIST_TEMPLATE,
  type SaccoChecklistStatus,
  type SaccoInternalControlChecklistFilters,
  type SaccoInternalControlChecklistRecord,
  type SaccoInternalControlChecklistSummary,
} from "./sacco-internal-control-checklist-types";

type ChecklistUser = {
  role: string;
  branchId?: string | null;
  id?: string | null;
  name?: string | null;
};

type ChecklistOptions = SaccoInternalControlChecklistFilters & {
  user: ChecklistUser;
};

const REPORT_CODE = "sacco-internal-control-checklist";
const REPORT_ENTITY = "InternalControlChecklistSnapshot";

function currentPeriodKey() {
  return new Date().toISOString().slice(0, 7);
}

function normalizeStatus(value: unknown): SaccoChecklistStatus {
  if (value === "PASS" || value === "FAIL" || value === "PARTIAL" || value === "NA") {
    return value;
  }
  return "PENDING";
}

function branchMatch(branchId: string | undefined, requestedBranchId: string | undefined) {
  if (!requestedBranchId) return true;
  return branchId === requestedBranchId;
}

function mapSnapshotToRecords(
  snapshot:
    | {
        details: unknown;
        entityId: string | null;
        timestamp: Date;
        user: { name: string | null } | null;
      }
    | null,
  branchId: string | undefined,
  branchName: string,
  periodKey: string,
) {
  const details = (snapshot?.details && typeof snapshot.details === "object"
    ? (snapshot.details as Record<string, unknown>)
    : {}) as Record<string, unknown>;
  const savedItems = Array.isArray(details.items) ? (details.items as Record<string, unknown>[]) : [];
  const itemMap = new Map(
    savedItems.map((item) => [String(item.itemCode || ""), item]),
  );

  return SACCO_INTERNAL_CONTROL_CHECKLIST_TEMPLATE.map((template) => {
    const saved = itemMap.get(template.itemCode);
    return {
      id: snapshot ? snapshot.entityId : null,
      branchId: branchId || "",
      branchName,
      periodKey,
      itemCode: template.itemCode,
      itemLabel: template.itemLabel,
      controlArea: template.controlArea,
      guidance: template.guidance,
      status: normalizeStatus(saved?.status),
      remarks: typeof saved?.remarks === "string" ? saved.remarks : "",
      evidence: typeof saved?.evidence === "string" ? saved.evidence : "",
      reviewedAt: snapshot ? snapshot.timestamp.toISOString() : null,
      reviewedByName: snapshot?.user?.name || null,
    } satisfies SaccoInternalControlChecklistRecord;
  });
}

export async function getSaccoInternalControlChecklistReport(options: ChecklistOptions) {
  const requestedPeriodKey = options.periodKey || currentPeriodKey();
  const scopedBranchId = resolveBranchScope(
    { role: options.user.role, branchId: options.user.branchId || undefined },
    options.branchId,
  );

  const branches = scopedBranchId
    ? [
        {
          id: scopedBranchId,
        },
      ]
    : await db.branch.findMany({
        select: {
          id: true,
        },
        orderBy: {
          name: "asc",
        },
      });

  const selectedBranches = branches.filter((branch) =>
    branchMatch(branch.id, scopedBranchId),
  );

  const branchLookups = selectedBranches.length
    ? await db.branch.findMany({
        where: {
          id: {
            in: selectedBranches.map((branch) => branch.id),
          },
        },
        select: {
          id: true,
          name: true,
        },
      })
    : [];

  const latestSnapshots = await Promise.all(
    selectedBranches.map(async (branch) => {
      const snapshot = await db.auditLog.findFirst({
        where: {
          action: REPORT_CODE,
          entityType: REPORT_ENTITY,
          entityId: `${requestedPeriodKey}:${branch.id}`,
        },
        include: {
          user: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          timestamp: "desc",
        },
      });

      return {
        branchId: branch.id,
        branchName:
          branchLookups.find((entry) => entry.id === branch.id)?.name || "Branch",
        snapshot,
      };
    }),
  );

  const records = latestSnapshots.flatMap(({ branchId, branchName, snapshot }) =>
    mapSnapshotToRecords(snapshot, branchId, branchName, requestedPeriodKey),
  );

  const summary: SaccoInternalControlChecklistSummary = records.length
    ? {
        totalItems: records.length,
        passCount: records.filter((item) => item.status === "PASS").length,
        failCount: records.filter((item) => item.status === "FAIL").length,
        partialCount: records.filter((item) => item.status === "PARTIAL").length,
        naCount: records.filter((item) => item.status === "NA").length,
        pendingCount: records.filter((item) => item.status === "PENDING").length,
        completionRate:
          (records.filter((item) => item.status !== "PENDING").length / records.length) * 100,
      }
    : EMPTY_SACCO_INTERNAL_CONTROL_CHECKLIST_SUMMARY;

  return {
    branchId: scopedBranchId,
    periodKey: requestedPeriodKey,
    records,
    summary,
  };
}

export async function saveSaccoInternalControlChecklistReport(options: {
  user: ChecklistUser;
  branchId?: string;
  periodKey?: string;
  items: Array<{
    itemCode: string;
    itemLabel: string;
    controlArea: string;
    guidance?: string;
    status?: string;
    remarks?: string;
    evidence?: string;
  }>;
}) {
  const periodKey = options.periodKey || currentPeriodKey();
  const scopedBranchId = resolveBranchScope(
    { role: options.user.role, branchId: options.user.branchId || undefined },
    options.branchId,
  );

  if (!scopedBranchId) {
    throw new Error("A specific branch is required to save the checklist.");
  }

  const snapshot = await db.auditLog.create({
    data: {
      action: REPORT_CODE,
      entityType: REPORT_ENTITY,
      entityId: `${periodKey}:${scopedBranchId}`,
      userId: options.user.id || null,
      details: {
        reportCode: REPORT_CODE,
        periodKey,
        branchId: scopedBranchId,
        items: options.items.map((item) => ({
          itemCode: item.itemCode,
          itemLabel: item.itemLabel,
          controlArea: item.controlArea,
          guidance: item.guidance || "",
          status: normalizeStatus(item.status),
          remarks: item.remarks || "",
          evidence: item.evidence || "",
        })),
      } as any,
    },
    include: {
      user: {
        select: {
          name: true,
        },
      },
    },
  });

  return getSaccoInternalControlChecklistReport({
    user: options.user,
    branchId: scopedBranchId,
    periodKey,
  });
}
