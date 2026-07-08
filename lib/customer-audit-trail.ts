import { db } from "@/prisma/db";
import { randomUUID } from "crypto";

export type CustomerAuditActionType =
  | "Created"
  | "Edited"
  | "Deleted"
  | "Activated"
  | "Deactivated";

export type CustomerAuditSnapshotType = "BEFORE" | "AFTER";

export interface CustomerProfileSource {
  member?: {
    id: string;
    memberNumber: string;
    registrationDate?: Date | null;
    gender?: string | null;
    nin?: string | null;
    village?: string | null;
    parish?: string | null;
    subCounty?: string | null;
    constituency?: string | null;
    town?: string | null;
    district?: string | null;
    otherNames?: string | null;
  } | null;
  user?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    dateOfBirth?: Date | null;
    address?: string | null;
    nationalId?: string | null;
    branchId?: string | null;
  } | null;
}

export interface CustomerBranchSource {
  id?: string | null;
  code?: string | null;
  name?: string | null;
}

export interface CustomerAuditTrailRow {
  id: string;
  auditEventId: string;
  actionType: string;
  snapshotType: CustomerAuditSnapshotType;
  branchId: string | null;
  branchCode: string | null;
  branchName: string | null;
  changedBy: string | null;
  changedByUserId: string | null;
  changedAt: Date;
  customerId: string;
  fullName: string | null;
  dateOfBirth: Date | null;
  sex: string | null;
  address: string | null;
  phone: string | null;
  mobile: string | null;
  idCardNumber: string | null;
  refNumber: string | null;
  registrationDate: Date | null;
  groupCode: string | null;
  groupName: string | null;
}

export interface CustomerAuditTrailEvent {
  auditEventId: string;
  actionType: string;
  branchId: string | null;
  branchCode: string | null;
  branchName: string | null;
  changedBy: string | null;
  changedByUserId: string | null;
  changedAt: Date;
  customerId: string;
  before: CustomerAuditTrailRow | null;
  after: CustomerAuditTrailRow | null;
  changedFields: string[];
}

export interface CustomerAuditTrailFilters {
  branchId?: string;
  actionType?: string;
  search?: string;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
}

function escapeSql(value: string) {
  return value.replace(/'/g, "''");
}

function cleanText(value: unknown) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function buildFullName(source: CustomerProfileSource) {
  const parts = [
    cleanText(source.user?.firstName),
    cleanText(source.member?.otherNames),
    cleanText(source.user?.lastName),
  ].filter(Boolean) as string[];

  if (parts.length > 0) {
    return parts.join(" ").replace(/\s+/g, " ").trim();
  }

  return cleanText(source.user?.name);
}

function resolveSex(memberGender?: string | null) {
  if (!memberGender) return null;
  const value = String(memberGender).trim().toUpperCase();
  if (value.startsWith("MALE")) return "M";
  if (value.startsWith("FEMALE")) return "F";
  return value.slice(0, 1) || null;
}

function resolveAddress(source: CustomerProfileSource) {
  return (
    cleanText(source.user?.address) ||
    cleanText(source.member?.village) ||
    cleanText(source.member?.parish) ||
    cleanText(source.member?.subCounty) ||
    cleanText(source.member?.constituency) ||
    cleanText(source.member?.town) ||
    cleanText(source.member?.district)
  );
}

function resolvePhone(source: CustomerProfileSource) {
  return cleanText(source.user?.phone);
}

function resolveMobile(source: CustomerProfileSource) {
  return cleanText(source.user?.phone);
}

function resolveIdCard(source: CustomerProfileSource) {
  return cleanText(source.user?.nationalId) || cleanText(source.member?.nin);
}

function resolveBranchDescriptor(
  branch?: CustomerBranchSource | null,
  fallbackBranchId?: string | null,
) {
  const branchCode = cleanText(branch?.code) || cleanText(branch?.id) || cleanText(fallbackBranchId);
  const branchName = cleanText(branch?.name);
  return { branchCode, branchName };
}

export function buildCustomerAuditTrailRow(options: {
  source: CustomerProfileSource;
  customerId: string;
  branch?: CustomerBranchSource | null;
  changedBy?: string | null;
  changedByUserId?: string | null;
  changedAt?: Date;
  actionType: CustomerAuditActionType;
  snapshotType: CustomerAuditSnapshotType;
}): Omit<CustomerAuditTrailRow, "id"> {
  const changedAt = options.changedAt ?? new Date();
  const { branchCode, branchName } = resolveBranchDescriptor(
    options.branch,
    options.source.user?.branchId,
  );

  return {
    auditEventId: "",
    actionType: options.actionType,
    snapshotType: options.snapshotType,
    branchId: cleanText(options.source.user?.branchId),
    branchCode,
    branchName,
    changedBy: cleanText(options.changedBy),
    changedByUserId: cleanText(options.changedByUserId),
    changedAt,
    customerId: options.customerId,
    fullName: buildFullName(options.source),
    dateOfBirth: options.source.user?.dateOfBirth ?? null,
    sex: resolveSex(options.source.member?.gender),
    address: resolveAddress(options.source),
    phone: resolvePhone(options.source),
    mobile: resolveMobile(options.source),
    idCardNumber: resolveIdCard(options.source),
    refNumber: cleanText(options.source.member?.memberNumber),
    registrationDate: options.source.member?.registrationDate ?? null,
    groupCode: null,
    groupName: null,
  };
}

export function compareAuditTrailRows(
  before: Omit<CustomerAuditTrailRow, "id"> | null,
  after: Omit<CustomerAuditTrailRow, "id"> | null,
) {
  const fields: Array<keyof Omit<CustomerAuditTrailRow, "id">> = [
    "fullName",
    "dateOfBirth",
    "sex",
    "address",
    "phone",
    "mobile",
    "idCardNumber",
    "refNumber",
    "registrationDate",
    "groupCode",
    "groupName",
  ];

  return fields.filter((field) => {
    const beforeValue = before?.[field];
    const afterValue = after?.[field];
    const beforeNormalized =
      beforeValue instanceof Date
        ? beforeValue.toISOString()
        : beforeValue ?? null;
    const afterNormalized =
      afterValue instanceof Date
        ? afterValue.toISOString()
        : afterValue ?? null;
    return beforeNormalized !== afterNormalized;
  }) as string[];
}

export function groupCustomerAuditTrailRows(rows: CustomerAuditTrailRow[]) {
  const eventMap = new Map<string, CustomerAuditTrailRow[]>();

  for (const row of rows) {
    const existing = eventMap.get(row.auditEventId) || [];
    existing.push(row);
    eventMap.set(row.auditEventId, existing);
  }

  const events: CustomerAuditTrailEvent[] = Array.from(eventMap.entries()).map(
    ([auditEventId, items]) => {
      const sortedItems = [...items].sort((a, b) => {
        if (a.snapshotType === b.snapshotType) return 0;
        return a.snapshotType === "BEFORE" ? -1 : 1;
      });

      const before =
        sortedItems.find((item) => item.snapshotType === "BEFORE") ||
        null;
      const after =
        sortedItems.find((item) => item.snapshotType === "AFTER") ||
        null;
      const first = before || after;

      return {
        auditEventId,
        actionType: first?.actionType || "Edited",
        branchId: first?.branchId || null,
        branchCode: first?.branchCode || null,
        branchName: first?.branchName || null,
        changedBy: first?.changedBy || null,
        changedByUserId: first?.changedByUserId || null,
        changedAt: first?.changedAt || new Date(),
        customerId: first?.customerId || "",
        before,
        after,
        changedFields: compareAuditTrailRows(before, after),
      };
    },
  );

  events.sort((a, b) => b.changedAt.getTime() - a.changedAt.getTime());
  return events;
}

export async function ensureCustomerAuditTrailSchema() {
  await db.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'CustomerAuditSnapshotType'
      ) THEN
        CREATE TYPE "CustomerAuditSnapshotType" AS ENUM ('BEFORE', 'AFTER');
      END IF;
    END $$;
  `);

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CustomerAuditTrail" (
      "id" TEXT PRIMARY KEY,
      "auditEventId" TEXT NOT NULL,
      "actionType" TEXT NOT NULL,
      "snapshotType" "CustomerAuditSnapshotType" NOT NULL,
      "branchId" TEXT NULL,
      "branchCode" TEXT NULL,
      "branchName" TEXT NULL,
      "changedBy" TEXT NULL,
      "changedByUserId" TEXT NULL,
      "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "customerId" TEXT NOT NULL,
      "fullName" TEXT NULL,
      "dateOfBirth" TIMESTAMP(3) NULL,
      "sex" TEXT NULL,
      "address" TEXT NULL,
      "phone" TEXT NULL,
      "mobile" TEXT NULL,
      "idCardNumber" TEXT NULL,
      "refNumber" TEXT NULL,
      "registrationDate" TIMESTAMP(3) NULL,
      "groupCode" TEXT NULL,
      "groupName" TEXT NULL,
      "previousRowId" TEXT NULL,
      "nextRowId" TEXT NULL
    );
  `);
}

function toSqlValue(value: unknown) {
  if (value === null || value === undefined) return "NULL";
  if (value instanceof Date) {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Kampala",
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const parts = formatter.formatToParts(value);
    const get = (type: string) => parts.find((part) => part.type === type)?.value || "";
    return `'${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}'`;
  }
  if (typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }
  return `'${escapeSql(String(value))}'`;
}

export async function recordCustomerAuditTrail(options: {
  actionType: CustomerAuditActionType;
  customerId: string;
  before: CustomerProfileSource;
  after: CustomerProfileSource;
  changedBy?: string | null;
  changedByUserId?: string | null;
  branch?: CustomerBranchSource | null;
  changedAt?: Date;
}) {
  await ensureCustomerAuditTrailSchema();
  const auditEventId = randomUUID();
  const changedAt = options.changedAt ?? new Date();

  const beforeRow = buildCustomerAuditTrailRow({
    source: options.before,
    customerId: options.customerId,
    branch: options.branch,
    changedBy: options.changedBy,
    changedByUserId: options.changedByUserId,
    changedAt,
    actionType: options.actionType,
    snapshotType: "BEFORE",
  });

  const afterRow = buildCustomerAuditTrailRow({
    source: options.after,
    customerId: options.customerId,
    branch: options.branch,
    changedBy: options.changedBy,
    changedByUserId: options.changedByUserId,
    changedAt,
    actionType: options.actionType,
    snapshotType: "AFTER",
  });

  await db.$executeRawUnsafe(`
    INSERT INTO "CustomerAuditTrail" (
      "id",
      "auditEventId",
      "actionType",
      "snapshotType",
      "branchId",
      "branchCode",
      "branchName",
      "changedBy",
      "changedByUserId",
      "changedAt",
      "customerId",
      "fullName",
      "dateOfBirth",
      "sex",
      "address",
      "phone",
      "mobile",
      "idCardNumber",
      "refNumber",
      "registrationDate",
      "groupCode",
      "groupName",
      "previousRowId",
      "nextRowId"
    ) VALUES
    (
      ${toSqlValue(randomUUID())},
      ${toSqlValue(auditEventId)},
      ${toSqlValue(beforeRow.actionType)},
      ${toSqlValue(beforeRow.snapshotType)},
      ${toSqlValue(beforeRow.branchId)},
      ${toSqlValue(beforeRow.branchCode)},
      ${toSqlValue(beforeRow.branchName)},
      ${toSqlValue(beforeRow.changedBy)},
      ${toSqlValue(beforeRow.changedByUserId)},
      ${toSqlValue(beforeRow.changedAt)},
      ${toSqlValue(beforeRow.customerId)},
      ${toSqlValue(beforeRow.fullName)},
      ${toSqlValue(beforeRow.dateOfBirth)},
      ${toSqlValue(beforeRow.sex)},
      ${toSqlValue(beforeRow.address)},
      ${toSqlValue(beforeRow.phone)},
      ${toSqlValue(beforeRow.mobile)},
      ${toSqlValue(beforeRow.idCardNumber)},
      ${toSqlValue(beforeRow.refNumber)},
      ${toSqlValue(beforeRow.registrationDate)},
      ${toSqlValue(beforeRow.groupCode)},
      ${toSqlValue(beforeRow.groupName)},
      NULL,
      NULL
    ),
    (
      ${toSqlValue(randomUUID())},
      ${toSqlValue(auditEventId)},
      ${toSqlValue(afterRow.actionType)},
      ${toSqlValue(afterRow.snapshotType)},
      ${toSqlValue(afterRow.branchId)},
      ${toSqlValue(afterRow.branchCode)},
      ${toSqlValue(afterRow.branchName)},
      ${toSqlValue(afterRow.changedBy)},
      ${toSqlValue(afterRow.changedByUserId)},
      ${toSqlValue(afterRow.changedAt)},
      ${toSqlValue(afterRow.customerId)},
      ${toSqlValue(afterRow.fullName)},
      ${toSqlValue(afterRow.dateOfBirth)},
      ${toSqlValue(afterRow.sex)},
      ${toSqlValue(afterRow.address)},
      ${toSqlValue(afterRow.phone)},
      ${toSqlValue(afterRow.mobile)},
      ${toSqlValue(afterRow.idCardNumber)},
      ${toSqlValue(afterRow.refNumber)},
      ${toSqlValue(afterRow.registrationDate)},
      ${toSqlValue(afterRow.groupCode)},
      ${toSqlValue(afterRow.groupName)},
      NULL,
      NULL
    );
  `);

  return { auditEventId, beforeRow, afterRow };
}
