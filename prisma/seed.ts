import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { execSync } from "child_process";
import { createHash } from "crypto";
import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { seedExpenditureCategories } from "./seed-expenditure-categories.ts";
import { seedIncomeCategories } from "./seed-income-categories.ts";
import { ensureLiabilityStructure } from "../lib/services/liability-structure.ts";
import { LoanProductService } from "../lib/services/loan-product.ts";
import { seedKisingaInstitutions } from "./seed-kisinga-institutions.ts";
import { VOLUNTARY_SAVINGS_ACCOUNT_TYPE_NAME } from "../lib/accounting/account-type-rules.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadMembersFromMarkdown(): any[] {
  const markdownPath = resolve(__dirname, "../progress/members-seed.md");
  const markdown = readFileSync(markdownPath, "utf8");
  const lines = markdown.split(/\r?\n/);
  const dataRows = lines.filter(
    (line) => line.startsWith("|") && !line.startsWith("|---"),
  );

  const rows = dataRows.slice(1);

  return rows
    .map((line) => {
      const cells = line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim());

      if (cells.length < 9) return null;

      const [, accountNo, name, regDate, address, idCard, dob, mobile, age] =
        cells;

      return {
        rowNumber: cells[0],
        accountNo,
        name,
        regDate,
        address,
        idCard,
        dateOfBirth: dob,
        mobile,
        age,
      };
    })
    .filter(Boolean);
}

const membersData = loadMembersFromMarkdown();

const prisma = new PrismaClient({
  log: ["error", "warn"],
});

// Test connection with retries
async function testConnection(retries = 3): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      await prisma.$connect();
      console.log("✅ Database connected successfully!");
      return;
    } catch (error) {
      console.log(`⚠️  Connection attempt ${i + 1}/${retries} failed`);
      if (i === retries - 1) {
        console.error("❌ Failed to connect after", retries, "attempts");
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

// Helper function to safely delete with retry
async function safeDelete(
  modelName: string,
  deleteFunc: () => Promise<any>,
  retries = 3,
) {
  for (let i = 0; i < retries; i++) {
    try {
      await deleteFunc();
      return;
    } catch (error: any) {
      if (error.code === "P1017" && i < retries - 1) {
        console.log(
          `⚠️  Connection lost while deleting ${modelName}, reconnecting... (${i + 1}/${retries})`,
        );
        await prisma.$disconnect();
        await new Promise((resolve) => setTimeout(resolve, 2000));
        await prisma.$connect();
      } else {
        throw error;
      }
    }
  }
}

// Helper function to generate email from name
function generateEmail(name: string): string {
  const cleanName = name
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .trim()
    .split(" ")
    .slice(0, 2)
    .join(".");
  return `${cleanName}@bukonzosacco.ug`;
}

// Helper function to generate username from name
function generateUsername(name: string): string {
  const cleanName = name
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .trim()
    .split(" ")
    .join("_");
  return cleanName.substring(0, 30); // Limit username length
}

function normalizeLookupText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeNameForIdentity(name: unknown): string {
  return normalizeLookupText(name);
}

function generateMemberNumber(identityKey: string, index: number): string {
  const digest = createHash("sha1")
    .update(identityKey || String(index))
    .digest("hex")
    .slice(0, 12)
    .toUpperCase();

  return `MEM-${digest}`;
}

// Helper function to clean phone number
function cleanPhone(phone: string | null): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/\s/g, "").replace(/-/g, "");
  // Ensure proper Uganda format
  if (cleaned.startsWith("07")) {
    return `+256${cleaned.substring(1)}`;
  }
  if (cleaned.startsWith("256")) {
    return `+${cleaned}`;
  }
  if (cleaned.startsWith("+256")) {
    return cleaned;
  }
  return null;
}

function normalizeNin(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.trim().toUpperCase().replace(/\s+/g, "").replace(/-/g, "");
}

function parseSeedDate(value: unknown): Date | null {
  if (!value || typeof value !== "string") return null;
  const [day, month, year] = value.split("/");
  if (!day || !month || !year) return null;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseFlexibleSeedDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  return (
    parseSeedDate(trimmed) ||
    (() => {
      const parsed = new Date(trimmed);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    })()
  );
}

function getMemberRegistrationDate(memberData: any): Date {
  const rawDate =
    memberData.registrationDate ||
    memberData.registration_date ||
    memberData.regDate ||
    memberData.reg_date ||
    memberData["Reg. Date"];

  return (
    parseSeedDate(rawDate) ||
    (memberData.createdAt ? new Date(memberData.createdAt) : null) ||
    new Date()
  );
}

function getMemberIdCardValue(memberData: any): string | null {
  const rawId =
    memberData.idCard ||
    memberData.id_card ||
    memberData["ID Card"] ||
    memberData.nin ||
    memberData.nationalId ||
    memberData.national_id ||
    null;

  if (!rawId) return null;
  return String(rawId).trim().replace(/\s+/g, " ");
}

function getMemberIdCard(memberData: any): string | null {
  const normalized = normalizeNin(
    memberData.idCard ||
      memberData.id_card ||
      memberData["ID Card"] ||
      memberData.nin ||
      memberData.nationalId ||
      memberData.national_id ||
      null,
  );

  if (!normalized) return null;
  return /^(CM|CF)[A-Z0-9]{13}$/.test(normalized) ? normalized : null;
}

function getMemberTypeOfId(memberData: any): string | null {
  const rawId = getMemberIdCardValue(memberData);
  if (!rawId) return null;
  if (/^(CM|CF)[A-Z0-9]{13}$/i.test(rawId)) {
    return "National Identity Card";
  }
  return rawId;
}

function getMemberDateOfBirth(memberData: any): Date | null {
  const rawDate =
    memberData.dateOfBirth ||
    memberData.dob ||
    memberData.birthDate ||
    memberData["Date of Birth"] ||
    memberData.date_of_birth;

  return parseFlexibleSeedDate(rawDate);
}

function buildMemberIdentityKey(memberData: any): string {
  const name = normalizeNameForIdentity(memberData.name);
  const phone = normalizeLookupText(memberData.phone);
  const dob = normalizeLookupText(
    memberData.dateOfBirth || memberData.dob || memberData.birthDate,
  );
  const address = normalizeNameForIdentity(memberData.address);
  const idCard = String(getMemberIdCardValue(memberData) || "").trim();

  return [name, phone, dob, address, idCard].filter(Boolean).join("|");
}

async function main() {
  await testConnection();

  console.log("🌱 Starting database seeding...");

  // Clear existing data (in correct order to handle foreign keys)
  console.log("🗑️  Clearing existing data...");
  try {
    await safeDelete("Session", () => prisma.session.deleteMany());
    await safeDelete("StandingOrderExecution", () =>
      prisma.standingOrderExecution.deleteMany(),
    );
    await safeDelete("StandingOrder", () => prisma.standingOrder.deleteMany());
    await safeDelete("SmsLog", () => prisma.smsLog.deleteMany());
    await safeDelete("CustomerFeedback", () =>
      prisma.customerFeedback.deleteMany(),
    );
    await safeDelete("StatementEmailLog", () =>
      prisma.statementEmailLog.deleteMany(),
    );
    await safeDelete("Statement", () => prisma.statement.deleteMany());
    await safeDelete("AssetMaintenance", () =>
      prisma.assetMaintenance.deleteMany(),
    );
    await safeDelete("AssetDepreciation", () =>
      prisma.assetDepreciation.deleteMany(),
    );
    await safeDelete("FixedAsset", () => prisma.fixedAsset.deleteMany());
    await safeDelete("AccountTransaction", () =>
      prisma.accountTransaction.deleteMany(),
    );
    await safeDelete("JournalEntry", () => prisma.journalEntry.deleteMany());
    await safeDelete("ChartOfAccount", () =>
      prisma.chartOfAccount.deleteMany(),
    );
    await safeDelete("TransactionSession", () =>
      prisma.transactionSession.deleteMany(),
    );
    await safeDelete("TransactionBatch", () =>
      prisma.transactionBatch.deleteMany(),
    );
    await safeDelete("FixedDeposit", () => prisma.fixedDeposit.deleteMany());
    await safeDelete("ShareTransaction", () =>
      prisma.shareTransaction.deleteMany(),
    );
    await safeDelete("ShareAccount", () => prisma.shareAccount.deleteMany());
    await safeDelete("SavingsTransaction", () =>
      prisma.savingsTransaction.deleteMany(),
    );
    await safeDelete("SavingsAccount", () =>
      prisma.savingsAccount.deleteMany(),
    );
    await safeDelete("InstitutionWithdrawal", () =>
      prisma.institutionWithdrawal.deleteMany(),
    );
    await safeDelete("AccountHold", () => prisma.accountHold.deleteMany());
    await safeDelete("LoanReschedule", () =>
      prisma.loanReschedule.deleteMany(),
    );
    await safeDelete("BranchReserveAllocation", () =>
      prisma.branchReserveAllocation.deleteMany(),
    );
    await safeDelete("CashShortage", () => prisma.cashShortage.deleteMany());
    await safeDelete("SuspenseTransaction", () =>
      prisma.suspenseTransaction.deleteMany(),
    );
    await safeDelete("SuspenseAccount", () =>
      prisma.suspenseAccount.deleteMany(),
    );
    await safeDelete("Budget", () => prisma.budget.deleteMany());
    await safeDelete("FinancialPeriod", () =>
      prisma.financialPeriod.deleteMany(),
    );
    await safeDelete("ExpenditureRecord", () =>
      prisma.expenditureRecord.deleteMany(),
    );
    await safeDelete("ExpenditureCategory", () =>
      prisma.expenditureCategory.deleteMany(),
    );
    await safeDelete("IncomeRecord", () => prisma.incomeRecord.deleteMany());
    await safeDelete("VaultReconciliation", () =>
      prisma.vaultReconciliation.deleteMany(),
    );
    await safeDelete("VaultTransaction", () =>
      prisma.vaultTransaction.deleteMany(),
    );
    await safeDelete("Vault", () => prisma.vault.deleteMany());
    await safeDelete("FloatReconciliation", () =>
      prisma.floatReconciliation.deleteMany(),
    );
    await safeDelete("FloatTransaction", () =>
      prisma.floatTransaction.deleteMany(),
    );
    await safeDelete("FloatAllocation", () =>
      prisma.floatAllocation.deleteMany(),
    );
    await safeDelete("UserFloat", () => prisma.userFloat.deleteMany());
    await safeDelete("LoanWriteOff", () => prisma.loanWriteOff.deleteMany());
    await safeDelete("LoanRepaymentRequest", () =>
      prisma.loanRepaymentRequest.deleteMany(),
    );
    await safeDelete("InstitutionLoanRepayment", () =>
      prisma.institutionLoanRepayment.deleteMany(),
    );
    await safeDelete("InstitutionLoan", () =>
      prisma.institutionLoan.deleteMany(),
    );
    await safeDelete("InstitutionLoanApplication", () =>
      prisma.institutionLoanApplication.deleteMany(),
    );
    await safeDelete("InsuranceContribution", () =>
      prisma.insuranceContribution.deleteMany(),
    );
    await safeDelete("LoanAppeal", () => prisma.loanAppeal.deleteMany());
    await safeDelete("LoanRepayment", () => prisma.loanRepayment.deleteMany());
    await safeDelete("Loan", () => prisma.loan.deleteMany());
    await safeDelete("LoanApplication", () =>
      prisma.loanApplication.deleteMany(),
    );
    await safeDelete("LoanProduct", () => prisma.loanProduct.deleteMany());
    await safeDelete("WithdrawalVerification", () =>
      prisma.withdrawalVerification.deleteMany(),
    );
    await safeDelete("Withdrawal", () => prisma.withdrawal.deleteMany());
    await safeDelete("Deposit", () => prisma.deposit.deleteMany());
    await safeDelete("Transaction", () => prisma.transaction.deleteMany());
    await safeDelete("Account", () => prisma.account.deleteMany());
    await safeDelete("AccountType", () => prisma.accountType.deleteMany());
    await safeDelete("InstitutionSignatory", () =>
      prisma.institutionSignatory.deleteMany(),
    );
    await safeDelete("Institution", () => prisma.institution.deleteMany());
    await safeDelete("Member", () => prisma.member.deleteMany());
    await safeDelete("AuditLog", () => prisma.auditLog.deleteMany());
    await safeDelete("Notification", () => prisma.notification.deleteMany());
    await safeDelete("ApiKey", () => prisma.apiKey.deleteMany());
    await safeDelete("User", () => prisma.user.deleteMany());
    await safeDelete("Branch", () => prisma.branch.deleteMany());
    console.log("✅ Cleared existing data");
  } catch (error) {
    console.error("❌ Error clearing data:", error);
    console.log(
      "💡 Tip: If this is a fresh database, comment out the deletion section.",
    );
    throw error;
  }

  // Create Branches
  console.log("🏢 Creating branches...");
  const mainBranch = await prisma.branch.create({
    data: {
      name: "Main Branch - Kisinga",
      location: "Kisinga, Kasese District",
      contactPerson: "Branch Manager",
      contactPhone: "+256700111222",
      email: "kisinga@bukonzosacco.ug",
    },
  });

  const eastBranch = await prisma.branch.create({
    data: {
      name: "East Branch - Kagando",
      location: "Kagando, Kasese District",
      contactPerson: "East Manager",
      contactPhone: "+256700222333",
      email: "kagando@bukonzosacco.ug",
    },
  });

  console.log("🏢 Seeding Kisinga institutions...");
  const kisingaInstitutionSeed = await seedKisingaInstitutions(
    prisma,
    mainBranch.id,
  );
  console.log(
    `✅ Kisinga institutions seeded: ${kisingaInstitutionSeed.created} created, ${kisingaInstitutionSeed.updated} updated`,
  );

  // Create Users
  console.log("👥 Creating staff users...");
  const hashedPassword = await bcrypt.hash("password123", 10);
  const tellerPassword = await bcrypt.hash("password@2026", 10);

  const admin = await prisma.user.create({
    data: {
      firstName: "Admin",
      lastName: "User",
      name: "Admin User",
      email: "admin@bukonzosacco.ug",
      password: hashedPassword,
      phone: "+256700000001",
      role: "ADMIN",
      isActive: true,
      isVerified: true,
      requiresPasswordChange: false,
    },
  });

  const jacklinePassword = await bcrypt.hash("Password@2026", 10);
  const jacklineAdmin = await prisma.user.create({
    data: {
      firstName: "Jackline",
      lastName: "Muhahiria",
      name: "Jackline Muhahiria",
      email: "jacklinemuhahiria77@gmail.com",
      password: jacklinePassword,
      phone: "+256799999999",
      role: "ADMIN",
      isActive: true,
      isVerified: true,
      branchId: mainBranch.id,
      requiresPasswordChange: false,
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: "manager@bukonzosacco.ug" },
    update: {
      firstName: "Manager",
      lastName: "User",
      name: "Manager User",
      password: hashedPassword,
      phone: "+256700000002",
      role: "BRANCHMANAGER",
      isActive: true,
      isVerified: true,
      branchId: mainBranch.id,
      requiresPasswordChange: false,
    },
    create: {
      firstName: "Manager",
      lastName: "User",
      name: "Manager User",
      email: "manager@bukonzosacco.ug",
      password: hashedPassword,
      phone: "+256700000002",
      role: "BRANCHMANAGER",
      isActive: true,
      isVerified: true,
      branchId: mainBranch.id,
      requiresPasswordChange: false,
    },
  });

  const makokaManagerPassword = await bcrypt.hash("Password@2026", 10);
  const makokaManager = await prisma.user.upsert({
    where: { email: "makokameresi@gmail.com" },
    update: {
      firstName: "Makoka",
      lastName: "Meresi",
      name: "Makoka Meresi",
      password: makokaManagerPassword,
      phone: null,
      role: "BRANCHMANAGER",
      isActive: true,
      isVerified: true,
      branchId: mainBranch.id,
      requiresPasswordChange: false,
    },
    create: {
      firstName: "Makoka",
      lastName: "Meresi",
      name: "Makoka Meresi",
      email: "makokameresi@gmail.com",
      password: makokaManagerPassword,
      role: "BRANCHMANAGER",
      isActive: true,
      isVerified: true,
      branchId: mainBranch.id,
      requiresPasswordChange: false,
    },
  });

  const teller1 = await prisma.user.create({
    data: {
      firstName: "Teller",
      lastName: "One",
      name: "Teller One",
      email: "teller1@bukonzosacco.ug",
      password: hashedPassword,
      phone: "+256700000003",
      role: "TELLER",
      isActive: true,
      isVerified: true,
      requiresPasswordChange: false,
    },
  });

  const teller2 = await prisma.user.create({
    data: {
      firstName: "Teller",
      lastName: "Two",
      name: "Teller Two",
      email: "teller2@bukonzosacco.ug",
      password: hashedPassword,
      phone: "+256700000004",
      role: "TELLER",
      isActive: true,
      isVerified: true,
      branchId: eastBranch.id,
      requiresPasswordChange: false,
    },
  });

  const thegherwakoAsanasio = await prisma.user.create({
    data: {
      firstName: "Thegherwako",
      lastName: "Asanasio",
      name: "Thegherwako Asanasio",
      email: "thegherwako.asanasio@gmail.com",
      password: tellerPassword,
      phone: "+256700000008",
      role: "TELLER",
      isActive: true,
      isVerified: true,
      branchId: mainBranch.id,
      requiresPasswordChange: false,
    },
  });

  const pascalBwambale = await prisma.user.create({
    data: {
      firstName: "Pascal",
      lastName: "Bwambale",
      name: "Pascal Bwambale",
      email: "pascalbwambale@gmail.com",
      password: tellerPassword,
      phone: "+256700000009",
      role: "TELLER",
      isActive: true,
      isVerified: true,
      branchId: eastBranch.id,
      requiresPasswordChange: false,
    },
  });

  const agent = await prisma.user.create({
    data: {
      firstName: "Field",
      lastName: "Agent",
      name: "Field Agent",
      email: "agent@bukonzosacco.ug",
      password: hashedPassword,
      phone: "+256700000005",
      role: "AGENT",
      isActive: true,
      isVerified: true,
      requiresPasswordChange: false,
    },
  });

  const loanOfficer = await prisma.user.create({
    data: {
      firstName: "Loan",
      lastName: "Officer",
      name: "Loan Officer",
      email: "loanofficer@bukonzosacco.ug",
      password: hashedPassword,
      phone: "+256700000006",
      role: "LOANOFFICER",
      isActive: true,
      isVerified: true,
      requiresPasswordChange: false,
    },
  });

  const accountant = await prisma.user.create({
    data: {
      firstName: "Accountant",
      lastName: "User",
      name: "Accountant User",
      email: "accountant@bukonzosacco.ug",
      password: hashedPassword,
      phone: "+256700000007",
      role: "ACCOUNTANT",
      isActive: true,
      isVerified: true,
      requiresPasswordChange: false,
    },
  });

  // Update branches with manager and accountant
  await prisma.branch.update({
    where: { id: mainBranch.id },
    data: {
      managerId: manager.id,
      accountantId: accountant.id,
    },
  });

  // Seed global expenditure categories
  console.log("💼 Seeding expenditure categories...");
  await seedExpenditureCategories();

  // Seed global income categories and liability classifications
  console.log("💼 Seeding income categories...");
  await seedIncomeCategories();

  console.log("💼 Ensuring liability structure...");
  await ensureLiabilityStructure();

  // ─── BUTCS Savings Products ───────────────────────────────────────────────
  console.log("💳 Creating BUTCS savings product types...");

  // Voluntary Savings withdrawal fee tiers: UGX 300 – 1,000 based on amount
  const voluntaryWithdrawalTiers = JSON.stringify([
    { max: 50000, fee: 300 },
    { max: 200000, fee: 500 },
    { max: 500000, fee: 700 },
    { max: null, fee: 1000 },
  ]);

  // Junior Savings uses the same tiered fee structure
  const juniorWithdrawalTiers = JSON.stringify([
    { max: 50000, fee: 300 },
    { max: 200000, fee: 500 },
    { max: 500000, fee: 700 },
    { max: null, fee: 1000 },
  ]);

  // 1. Voluntary Savings — default account for every member
  const savingsType = await prisma.accountType.upsert({
    where: { name: VOLUNTARY_SAVINGS_ACCOUNT_TYPE_NAME },
    update: {
      interestRate: 0,
      interestPeriod: "MONTHLY",
      minBalance: 5000,
      isDefault: true,
      isLoanEligible: true,
      canWithdraw: true,
      monthlyCharge: 500,
      withdrawalFeeTiers: voluntaryWithdrawalTiers,
      hasFixedPeriod: false,
      isShareAccount: false,
    },
    create: {
      name: VOLUNTARY_SAVINGS_ACCOUNT_TYPE_NAME,
      interestRate: 0,
      interestPeriod: "MONTHLY",
      minBalance: 5000,
      isDefault: true,
      isLoanEligible: true,
      canWithdraw: true,
      monthlyCharge: 500,
      withdrawalFeeTiers: voluntaryWithdrawalTiers,
      hasFixedPeriod: false,
      isShareAccount: false,
    },
  });

  // 2. Compulsory Savings — 18 % p.a., locked for 12 months from account opening
  await prisma.accountType.upsert({
    where: { name: "Compulsory Savings" },
    update: {
      interestRate: 18,
      interestPeriod: "ANNUALLY",
      minBalance: 0,
      isDefault: false,
      isLoanEligible: true,
      canWithdraw: false,
      monthlyCharge: 0,
      hasFixedPeriod: false,
      isShareAccount: false,
    },
    create: {
      name: "Compulsory Savings",
      interestRate: 18,
      interestPeriod: "ANNUALLY",
      minBalance: 0,
      isDefault: false,
      isLoanEligible: true,
      canWithdraw: false, // blocked until account is ≥ 12 months old
      monthlyCharge: 0,
      hasFixedPeriod: false, // lock enforced by transaction logic, not schema
      isShareAccount: false,
    },
  });

  // 3. Fixed Savings — 10 % p.a., term (3/6/9/12 months) chosen at account opening
  await prisma.accountType.upsert({
    where: { name: "Fixed Savings" },
    update: {
      interestRate: 10,
      interestPeriod: "ANNUALLY",
      minBalance: 500000,
      isDefault: false,
      isLoanEligible: false,
      canWithdraw: false,
      monthlyCharge: 0,
      hasFixedPeriod: true,
      fixedPeriodMonths: null,
      maturityTransferAccountType: VOLUNTARY_SAVINGS_ACCOUNT_TYPE_NAME,
      isShareAccount: false,
    },
    create: {
      name: "Fixed Savings",
      interestRate: 10,
      interestPeriod: "ANNUALLY",
      minBalance: 500000,
      isDefault: false,
      isLoanEligible: false,
      canWithdraw: false,
      monthlyCharge: 0,
      hasFixedPeriod: true,
      fixedPeriodMonths: null, // term stored on Account.fixingEndDate at opening
      maturityTransferAccountType: VOLUNTARY_SAVINGS_ACCOUNT_TYPE_NAME,
      isShareAccount: false,
    },
  });

  // Remove old per-variant types if they exist and have no accounts
  for (const variantName of [
    "Fixed Savings - 3 Months",
    "Fixed Savings - 6 Months",
    "Fixed Savings - 9 Months",
    "Fixed Savings - 12 Months",
  ]) {
    try {
      const legacy = await prisma.accountType.findUnique({
        where: { name: variantName },
        include: { _count: { select: { accounts: true } } },
      });
      if (legacy && legacy._count.accounts === 0) {
        await prisma.accountType.delete({ where: { name: variantName } });
        console.log(`  🗑️  Removed legacy variant: ${variantName}`);
      }
    } catch {
      /* ignore */
    }
  }

  // 7. Junior Savings — children < 18, 10 % p.a., withdraw once per 4 months
  const juniorSavingsType = await prisma.accountType.upsert({
    where: { name: "Junior Savings" },
    update: {
      interestRate: 10,
      interestPeriod: "ANNUALLY",
      minBalance: 0,
      isDefault: false,
      isLoanEligible: false,
      canWithdraw: true,
      monthlyCharge: 0,
      withdrawalFeeTiers: juniorWithdrawalTiers,
      withdrawalFrequencyDays: 120,
      hasFixedPeriod: false,
      isShareAccount: false,
    },
    create: {
      name: "Junior Savings",
      interestRate: 10,
      interestPeriod: "ANNUALLY",
      minBalance: 0,
      isDefault: false,
      isLoanEligible: false,
      canWithdraw: true,
      monthlyCharge: 0,
      withdrawalFeeTiers: juniorWithdrawalTiers,
      withdrawalFrequencyDays: 120, // once per ~4 months
      hasFixedPeriod: false,
      isShareAccount: false,
    },
  });

  await prisma.accountType.upsert({
    where: { name: "Loan Insurance" },
    update: {
      interestRate: 0,
      interestPeriod: "MONTHLY",
      minBalance: 0,
      isDefault: false,
      isLoanEligible: false,
      canWithdraw: false,
      monthlyCharge: 0,
      withdrawalFeeTiers: null,
      flatWithdrawalFee: null,
      withdrawalFrequencyDays: null,
      hasFixedPeriod: false,
      fixedPeriodMonths: null,
      maturityTransferAccountType: null,
      isShareAccount: false,
      earnsDividends: false,
      ledgerAccountId:
        (
          await prisma.chartOfAccount.findFirst({
            where: { accountCode: "200600", isActive: true },
            select: { id: true },
          })
        )?.id ?? null,
    },
    create: {
      name: "Loan Insurance",
      interestRate: 0,
      interestPeriod: "MONTHLY",
      minBalance: 0,
      isDefault: false,
      isLoanEligible: false,
      canWithdraw: false,
      monthlyCharge: 0,
      withdrawalFeeTiers: null,
      withdrawalFrequencyDays: null,
      hasFixedPeriod: false,
      isShareAccount: false,
      earnsDividends: false,
      ledgerAccountId:
        (
          await prisma.chartOfAccount.findFirst({
            where: { accountCode: "200600", isActive: true },
            select: { id: true },
          })
        )?.id ?? null,
    },
  });

  // 8–10. BUTCS Share Products — UGX 20,000 per share, dividend from annual surplus
  const SHARE_TYPES = [
    "Ordinary Shares",
    "Affiliate Shares",
    "Associate Shares",
  ] as const;
  for (const shareName of SHARE_TYPES) {
    await prisma.accountType.upsert({
      where: { name: shareName },
      update: {
        interestRate: 0,
        interestPeriod: "ANNUALLY",
        minBalance: 20000,
        isDefault: false,
        isShareAccount: true,
        canWithdraw: false,
        earnsDividends: true,
        isLoanEligible: false,
        sharePrice: 20000,
        monthlyCharge: 0,
        hasFixedPeriod: false,
      },
      create: {
        name: shareName,
        interestRate: 0,
        interestPeriod: "ANNUALLY",
        minBalance: 20000,
        isDefault: false,
        isShareAccount: true,
        canWithdraw: false,
        earnsDividends: true,
        isLoanEligible: false,
        sharePrice: 20000,
        monthlyCharge: 0,
        hasFixedPeriod: false,
      },
    });
  }

  // Remove old generic Share Capital if it has no accounts
  try {
    const legacyShares = await prisma.accountType.findUnique({
      where: { name: "Share Capital" },
      include: { _count: { select: { accounts: true } } },
    });
    if (legacyShares && legacyShares._count.accounts === 0) {
      await prisma.accountType.delete({ where: { name: "Share Capital" } });
      console.log("  🗑️  Removed legacy Share Capital type");
    }
  } catch {
    /* ignore */
  }

  // Remove legacy generic types that no longer apply (if they exist and have no accounts)
  for (const legacyName of [
    "Savings Account",
    "Junior Savings Account",
    "Fixed Deposit",
  ]) {
    try {
      const legacy = await prisma.accountType.findUnique({
        where: { name: legacyName },
        include: { _count: { select: { accounts: true } } },
      });
      if (legacy && legacy._count.accounts === 0) {
        await prisma.accountType.delete({ where: { name: legacyName } });
        console.log(`  🗑️  Removed legacy account type: ${legacyName}`);
      } else if (legacy) {
        console.log(
          `  ⚠️  Legacy type "${legacyName}" still has ${legacy._count.accounts} accounts — kept`,
        );
      }
    } catch {
      /* ignore */
    }
  }

  // Keep a reference to the fixed type (12-month variant) for downstream use
  const fixedType = await prisma.accountType.findFirst({
    where: { name: "Fixed Savings - 12 Months" },
  });

  // Create Loan Products through the shared service catalog
  console.log("🎯 Creating loan products...");
  await LoanProductService.ensureDefaultCatalog();
  const legacyLoanProduct = await prisma.loanProduct.findFirst({
    where: {
      name: "Commercial/business loan",
    },
  });

  if (!legacyLoanProduct) {
    throw new Error("Failed to seed default loan products");
  }

  // Seed Members from extracted data
  console.log("\n👥 Seeding members from SACCO data...");
  console.log(`Total members to process: ${membersData.length}`);

  const memberPassword = await bcrypt.hash("Member@2026", 10);
  let successCount = 0;
  let createdCount = 0;
  let updatedCount = 0;
  let duplicateCount = 0;
  let errorCount = 0;
  const errorDetails: any[] = [];
  const seenMemberKeys = new Set<string>();

  // Process in batches to speed up seeding
  const BATCH_SIZE = 20;

  for (let i = 0; i < membersData.length; i += BATCH_SIZE) {
    const batch = membersData.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (memberData: any, batchIndex: number) => {
        const globalIndex = i + batchIndex;
        try {
          const rawName = String(memberData.name || "")
            .trim()
            .replace(/\s+/g, " ");
          if (!rawName) {
            errorCount++;
            if (errorCount <= 10) console.log("Skipping record with no name");
            return;
          }

          const identityKey = buildMemberIdentityKey(memberData);
          if (seenMemberKeys.has(identityKey)) {
            duplicateCount++;
            return;
          }
          seenMemberKeys.add(identityKey);

          const memberNumber = generateMemberNumber(
            identityKey,
            globalIndex + 1,
          );
          const nameParts = rawName.split(" ").filter(Boolean);
          const firstName = nameParts[0] || rawName;
          const lastName =
            nameParts.slice(1).join(" ") || nameParts[0] || rawName;
          const memberIdCard = getMemberIdCard(memberData);
          const memberIdCardType = getMemberTypeOfId(memberData);
          const dateOfBirth = getMemberDateOfBirth(memberData);
          const age =
            typeof memberData.age === "number"
              ? memberData.age
              : Number.parseInt(String(memberData.age || ""), 10) || null;

          const femaleIndicators = [
            "mrs",
            "ms",
            "miss",
            "esther",
            "sarah",
            "mary",
            "jane",
          ];
          const nameToCheck = rawName.toLowerCase();
          const gender = memberIdCard?.startsWith("CF")
            ? "FEMALE"
            : memberIdCard?.startsWith("CM")
              ? "MALE"
              : femaleIndicators.some((indicator) =>
                    nameToCheck.includes(indicator),
                  )
                ? "FEMALE"
                : "MALE";

          const cleanedPhone = cleanPhone(memberData.phone);
          const registrationDate = getMemberRegistrationDate(memberData);

          const existingMember = await prisma.member.findUnique({
            where: { memberNumber },
            include: { user: true },
          });

          if (existingMember?.user) {
            await prisma.user.update({
              where: { id: existingMember.user.id },
              data: {
                firstName,
                lastName,
                name: rawName,
                phone: cleanedPhone,
                address: memberData.address || null,
                dateOfBirth,
                nationalId: memberIdCard,
                isActive: true,
                isVerified: true,
                branchId: mainBranch.id,
                requiresPasswordChange: false,
              },
            });

            await prisma.member.update({
              where: { id: existingMember.id },
              data: {
                registrationDate,
                age,
                nin: memberIdCard,
                typeOfId: memberIdCardType,
                surname: lastName,
                otherNames: firstName,
                gender,
                status: "ACTIVE",
                isApproved: true,
                approvalStatus: "APPROVED",
                approvedAt: new Date(),
                approvedByUserId: admin.id,
              },
            });

            updatedCount++;
          } else {
            const memberUser = await prisma.user.create({
              data: {
                firstName,
                lastName,
                name: rawName,
                email: null,
                password: memberPassword,
                phone: cleanedPhone,
                address: memberData.address || null,
                dateOfBirth,
                nationalId: memberIdCard,
                role: "MEMBER",
                isActive: true,
                isVerified: true,
                branchId: mainBranch.id,
                requiresPasswordChange: false,
              },
            });

            await prisma.member.create({
              data: {
                userId: memberUser.id,
                memberNumber,
                surname: lastName,
                otherNames: firstName,
                gender,
                status: "ACTIVE",
                isApproved: true,
                approvalStatus: "APPROVED",
                approvedAt: new Date(),
                approvedByUserId: admin.id,
                registrationDate,
                age,
                nin: memberIdCard,
                typeOfId: memberIdCardType,
                additionalDocs: [],
              },
            });

            createdCount++;
          }

          // Intentionally do not seed accounts, loans, or transactions here.
          // This import is for member identities only.

          successCount++;
        } catch (error: any) {
          errorCount++;
          if (errorCount <= 5) console.error(`  Error: ${error.message}`);
          errorDetails.push({
            name: String(memberData.name || `Row ${globalIndex + 1}`),
            error: error.message,
          });
        }
      }),
    );

    // Log progress
    console.log(
      `  Processed ${Math.min(i + BATCH_SIZE, membersData.length)} / ${membersData.length} members`,
    );
  }

  console.log(`\n✅ Member seeding complete!`);
  console.log(`  - Successfully seeded: ${successCount} members`);
  console.log(`  - Created: ${createdCount} members`);
  console.log(`  - Updated: ${updatedCount} members`);
  console.log(`  - Duplicate rows skipped: ${duplicateCount}`);
  console.log(`  - Errors: ${errorCount} members`);

  if (errorCount > 0 && errorCount <= 10) {
    console.log("\nError details:");
    errorDetails.forEach((err) => {
      console.log(`  - ${err.name}: ${err.error}`);
    });
  }

  // Create User Floats
  console.log("\n💵 Creating user floats...");
  const teller1Float = await prisma.userFloat.create({
    data: {
      userId: teller1.id,
      balance: 1000000,
    },
  });

  const teller2Float = await prisma.userFloat.create({
    data: {
      userId: teller2.id,
      balance: 500000,
    },
  });

  const thegherwakoFloat = await prisma.userFloat.create({
    data: {
      userId: thegherwakoAsanasio.id,
      balance: 250000,
    },
  });

  const pascalFloat = await prisma.userFloat.create({
    data: {
      userId: pascalBwambale.id,
      balance: 250000,
    },
  });

  // Create Vaults
  console.log("🏦 Creating vaults...");
  const mainVault = await prisma.vault.create({
    data: {
      name: "Main Vault - Kisinga",
      branchId: mainBranch.id,
      balance: 50000000,
      physicalCash: 50000000,
      isActive: true,
      custodianUserId: accountant.id,
    },
  });

  const eastVault = await prisma.vault.create({
    data: {
      name: "East Vault - Kagando",
      branchId: eastBranch.id,
      balance: 20000000,
      physicalCash: 20000000,
      isActive: true,
    },
  });

  // Create Income Categories
  console.log("📈 Creating income categories...");
  const loanInterest = await prisma.incomeCategory.upsert({
    where: { name: "Loan Interest" },
    update: {
      kind: "INCOME",
      description: "Interest earned from loans",
      isActive: true,
    },
    create: {
      name: "Loan Interest",
      kind: "INCOME",
      description: "Interest earned from loans",
      isActive: true,
    },
  });

  const membershipFees = await prisma.incomeCategory.upsert({
    where: { name: "Membership Fees" },
    update: {
      kind: "INCOME",
      description: "New member registration fees",
      isActive: true,
    },
    create: {
      name: "Membership Fees",
      kind: "INCOME",
      description: "New member registration fees",
      isActive: true,
    },
  });

  // Create Expenditure Categories
  console.log("📉 Creating expenditure categories...");
  const salaries = await prisma.expenditureCategory.create({
    data: {
      name: "Salaries",
      code: "SAL",
      kind: "EXPENSE",
      description: "Staff salaries and wages",
      isActive: true,
    },
  });

  const utilities = await prisma.expenditureCategory.create({
    data: {
      name: "Utilities",
      code: "UTL",
      kind: "EXPENSE",
      description: "Electricity, water, internet",
      isActive: true,
    },
  });

  // Seed Chart of Accounts
  console.log("📊 Seeding Chart of Accounts...");
  try {
    execSync("npx tsx scripts/seed-coa.ts", { stdio: "inherit" });
    console.log("✅ Chart of Accounts seeded successfully");
  } catch (error) {
    console.error("❌ Failed to seed Chart of Accounts:", error);
  }

  // Create Notifications for admin
  console.log("🔔 Creating notifications...");
  await prisma.notification.create({
    data: {
      userId: admin.id,
      type: "IN_APP",
      subject: "Database Seeded",
      message: `Successfully seeded ${successCount} members. Accounts and loan activity were intentionally not seeded.`,
      isRead: false,
    },
  });

  await prisma.notification.create({
    data: {
      userId: jacklineAdmin.id,
      type: "IN_APP",
      subject: "Welcome to Bukonzo SACCO",
      message: "Your administrator account has been created successfully",
      isRead: false,
    },
  });

  console.log("✅ Seeding completed successfully!");

  // Summary
  console.log("\n" + "=".repeat(70));
  console.log("📊 SEEDING SUMMARY");
  console.log("=".repeat(70));
  console.log(`Branches: ${await prisma.branch.count()}`);
  console.log(
    `Staff Users: ${await prisma.user.count({ where: { role: { not: "MEMBER" } } })}`,
  );
  console.log(
    `Member Users: ${await prisma.user.count({ where: { role: "MEMBER" } })}`,
  );
  console.log(`Total Users: ${await prisma.user.count()}`);
  console.log(`Members: ${await prisma.member.count()}`);
  console.log(`Account Types: ${await prisma.accountType.count()}`);
  console.log(`Accounts: ${await prisma.account.count()}`);
  console.log(`Loan Products: ${await prisma.loanProduct.count()}`);
  console.log(`Loan Applications: ${await prisma.loanApplication.count()}`);
  console.log(`Loans: ${await prisma.loan.count()}`);
  console.log(`Vaults: ${await prisma.vault.count()}`);

  // Financial Summary
  const totalSavings = await prisma.account.aggregate({
    where: { accountTypeId: savingsType.id },
    _sum: { balance: true },
  });

  const totalLoans = await prisma.loan.aggregate({
    _sum: {
      amountGranted: true,
      outstandingBalance: true,
    },
  });

  console.log("\n" + "=".repeat(70));
  console.log("💰 FINANCIAL SUMMARY");
  console.log("=".repeat(70));
  console.log(
    `Total Savings Balance: UGX ${(totalSavings._sum.balance || 0).toLocaleString()}`,
  );
  console.log(
    `Total Loans Disbursed: UGX ${(totalLoans._sum.amountGranted || 0).toLocaleString()}`,
  );
  console.log(
    `Total Loans Outstanding: UGX ${(totalLoans._sum.outstandingBalance || 0).toLocaleString()}`,
  );

  const repaymentRate =
    totalLoans._sum.amountGranted && totalLoans._sum.outstandingBalance
      ? ((totalLoans._sum.amountGranted - totalLoans._sum.outstandingBalance) /
          totalLoans._sum.amountGranted) *
        100
      : 0;
  console.log(`Loan Repayment Rate: ${repaymentRate.toFixed(1)}%`);

  console.log("\n" + "=".repeat(70));
  console.log("🔐 LOGIN CREDENTIALS");
  console.log("=".repeat(70));
  console.log("ADMIN ACCOUNTS:");
  console.log("  Email: admin@bukonzosacco.ug");
  console.log("  Password: password123");
  console.log("");
  console.log("  Email: jacklinemuhahiria77@gmail.com");
  console.log("  Password:                    ");
  console.log("");
  console.log("STAFF ACCOUNTS:");
  console.log("  Email: manager@bukonzosacco.ug | Password: password123");
  console.log("  Email: makokameresi@gmail.com | Password: Password@2026");
  console.log("  Email: teller1@bukonzosacco.ug | Password: password123");
  console.log(
    "  Email: thegherwako.asanasio@gmail.com | Password: password@2026",
  );
  console.log("  Email: pascalbwambale@gmail.com | Password: password@2026");
  console.log("  Email: loanofficer@bukonzosacco.ug | Password: password123");
  console.log("  Email: accountant@bukonzosacco.ug | Password: password123");
  console.log("");
  console.log("MEMBER ACCOUNTS (Login with Phone Number):");
  console.log("  All members login with: PHONE NUMBER");
  console.log("  Password: Member@2026");
  console.log("  (Must update profile on first login)");
  console.log("  Sample phones: +256777309854, +256777399495, +256773980505");
  console.log(
    "  Note: Members have NO email until they add it after first login",
  );
  console.log("=".repeat(70));
}

main()
  .catch((e) => {
    console.error("❌ Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
