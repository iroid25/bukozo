/*
  Warnings:

  - A unique constraint covering the columns `[fullCode]` on the table `ChartOfAccount` will be added. If there are existing duplicate values, this will fail.
  - Changed the type of `ledgerType` on the `ChartOfAccount` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'BRANCH_MANAGER', 'TELLER', 'AGENT', 'MEMBER', 'ACCOUNTANT', 'LOAN_OFFICER', 'INSTITUTION', 'AUDITOR');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'CLOSED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'LOAN_DISBURSEMENT', 'LOAN_REPAYMENT', 'FLOAT_ALLOCATION', 'FLOAT_PURCHASE', 'FLOAT_RECONCILIATION', 'FEE', 'OTHER');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REVERSED', 'APPROVED');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'DISBURSED', 'REPAID', 'OVERDUE', 'WRITTEN_OFF', 'UNDER_REVIEW');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('EMAIL', 'SMS', 'IN_APP');

-- CreateEnum
CREATE TYPE "LogType" AS ENUM ('SYSTEM', 'USER_ACTION', 'SECURITY', 'ERROR');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "MaritalStatus" AS ENUM ('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', 'SEPARATED', 'OTHER');

-- CreateEnum
CREATE TYPE "OtherSaccosCount" AS ENUM ('NONE', 'ONE', 'MANY');

-- CreateEnum
CREATE TYPE "FinancialDiscipline" AS ENUM ('EXCELLENT', 'NORMAL', 'WANTING');

-- CreateEnum
CREATE TYPE "ReconciliationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'UNDER_REVIEW');

-- CreateEnum
CREATE TYPE "ReconciliationType" AS ENUM ('REGULAR', 'START_OF_DAY', 'END_OF_DAY');

-- CreateEnum
CREATE TYPE "LoanStage" AS ENUM ('DRAFT', 'SUBMITTED', 'IN_ANALYSIS', 'FORWARDED_TO_MANAGER', 'APPROVED', 'REJECTED', 'DISBURSED', 'CLOSED');

-- CreateEnum
CREATE TYPE "CategoryKind" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK', 'MOBILE_MONEY', 'OTHER');

-- CreateEnum
CREATE TYPE "RecognitionBasis" AS ENUM ('CASH', 'ACCRUAL', 'DEDUCTION');

-- CreateEnum
CREATE TYPE "VaultTransactionType" AS ENUM ('INITIAL_DEPOSIT', 'FLOAT_ALLOCATION', 'FLOAT_RETURN', 'BANK_DEPOSIT', 'BANK_WITHDRAWAL', 'VAULT_TRANSFER', 'ADJUSTMENT', 'OVERAGE_RECEIVED', 'SHORTAGE_WRITTEN_OFF', 'RESERVE_ALLOCATION', 'RESERVE_RETURN');

-- CreateEnum
CREATE TYPE "InsuranceContributionType" AS ENUM ('CONTRIBUTION', 'PAYMENT_OUT');

-- CreateEnum
CREATE TYPE "RepaymentRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "WriteOffStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AccountLedgerType" AS ENUM ('ASSETS', 'LIABILITIES', 'EQUITY', 'INCOME', 'EXPENSES');

-- CreateEnum
CREATE TYPE "AccountCategory" AS ENUM ('SAVINGS', 'SHARES', 'FIXED_DEPOSIT');

-- CreateEnum
CREATE TYPE "SavingsAccountStatus" AS ENUM ('ACTIVE', 'ON_HOLD', 'CLOSED', 'DORMANT', 'FROZEN');

-- CreateEnum
CREATE TYPE "SavingsTransactionType" AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'INTEREST', 'FEE', 'TRANSFER_IN', 'TRANSFER_OUT', 'REVERSAL');

-- CreateEnum
CREATE TYPE "ShareTransactionType" AS ENUM ('PURCHASE', 'SALE', 'TRANSFER_IN', 'TRANSFER_OUT', 'DIVIDEND', 'REVERSAL');

-- CreateEnum
CREATE TYPE "FixedDepositStatus" AS ENUM ('ACTIVE', 'MATURED', 'WITHDRAWN', 'REVERSED', 'RENEWED');

-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'POSTED');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('OPEN', 'CLOSED', 'RECONCILED');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('ACTIVE', 'DISPOSED', 'WRITTEN_OFF', 'UNDER_MAINTENANCE');

-- CreateEnum
CREATE TYPE "StandingOrderFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "StandingOrderStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SmsType" AS ENUM ('TRANSACTION_ALERT', 'BALANCE_INQUIRY', 'MINI_STATEMENT', 'LOAN_ALERT', 'PROMOTIONAL', 'SYSTEM_NOTIFICATION');

-- CreateEnum
CREATE TYPE "SmsStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'DELIVERED');

-- CreateEnum
CREATE TYPE "FeedbackType" AS ENUM ('COMPLAINT', 'SUGGESTION', 'INQUIRY', 'COMPLIMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "AllocationType" AS ENUM ('ALLOCATION', 'RETURN');

-- CreateEnum
CREATE TYPE "RescheduleStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "WithdrawalMandate" AS ENUM ('ANY_1_SIGNATORY', 'ANY_2_SIGNATORIES', 'ANY_3_SIGNATORIES', 'ALL_SIGNATORIES', 'SPECIFIC_ROLES');

-- CreateEnum
CREATE TYPE "HoldReason" AS ENUM ('GUARANTOR_DEFAULT', 'FRAUD_INVESTIGATION', 'LEGAL_DISPUTE', 'ACCOUNT_REVIEW', 'MANUAL_HOLD', 'OTHER');

-- AlterTable
ALTER TABLE "ChartOfAccount" ALTER COLUMN "level" DROP DEFAULT,
DROP COLUMN "ledgerType",
ADD COLUMN     "ledgerType" "AccountLedgerType" NOT NULL;

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "address" TEXT,
    "nationalId" TEXT,
    "lastLogin" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "jobTitle" TEXT,
    "areaOfOperation" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'MEMBER',
    "password" TEXT,
    "branchId" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "token" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "contactPerson" TEXT,
    "contactPhone" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "accountantId" TEXT,
    "managerId" TEXT,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vault" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "branchId" TEXT,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "physicalCash" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastVerified" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "location" TEXT,
    "custodianUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vault_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaultTransaction" (
    "id" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "type" "VaultTransactionType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "balanceBefore" DOUBLE PRECISION NOT NULL,
    "balanceAfter" DOUBLE PRECISION NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,
    "relatedFloatAllocationId" TEXT,
    "relatedFloatReconciliationId" TEXT,
    "relatedUserId" TEXT,
    "performedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VaultTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaultReconciliation" (
    "id" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "reconciliationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "systemBalance" DOUBLE PRECISION NOT NULL,
    "physicalCash" DOUBLE PRECISION NOT NULL,
    "difference" DOUBLE PRECISION NOT NULL,
    "isBalanced" BOOLEAN NOT NULL,
    "reconciledByUserId" TEXT NOT NULL,
    "status" "ReconciliationStatus" NOT NULL DEFAULT 'PENDING',
    "approvedByUserId" TEXT,
    "approvalDate" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "VaultReconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "type" "NotificationType" NOT NULL,
    "subject" TEXT,
    "message" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "targetAddress" TEXT,
    "status" TEXT,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "oldValue" JSONB,
    "newValue" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "browser" TEXT,
    "os" TEXT,
    "details" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "memberNumber" TEXT NOT NULL,
    "registrationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "surname" TEXT,
    "otherNames" TEXT,
    "age" INTEGER,
    "gender" "Gender",
    "maritalStatus" "MaritalStatus",
    "maritalOther" TEXT,
    "nokName" TEXT,
    "nokRelationship" TEXT,
    "nokPhone" TEXT,
    "numberOfChildren" INTEGER,
    "numberOfDependants" INTEGER,
    "levelOfEducation" TEXT,
    "citizenship" TEXT,
    "occupation" TEXT,
    "otherFinancialInstitutions" TEXT,
    "fatherName" TEXT,
    "motherName" TEXT,
    "village" TEXT,
    "parish" TEXT,
    "subCounty" TEXT,
    "constituency" TEXT,
    "town" TEXT,
    "district" TEXT,
    "postalAddress" TEXT,
    "nin" TEXT,
    "typeOfId" TEXT,
    "certifiedBy" TEXT,
    "certifierAccountNo" TEXT,
    "certifierPhone" TEXT,
    "certifierSignature" TEXT,
    "certificationDate" TIMESTAMP(3),
    "withdrawalInstructions" TEXT,
    "applicantOccupationLC" TEXT,
    "designationLC" TEXT,
    "locationLC" TEXT,
    "otherSaccosCount" "OtherSaccosCount",
    "financialDiscipline" "FinancialDiscipline",
    "recommenderName" TEXT,
    "recommenderTitle" TEXT,
    "recommenderPhone" TEXT,
    "recommenderSignature" TEXT,
    "recommendationDate" TIMESTAMP(3),
    "entryFee" DOUBLE PRECISION,
    "initialSavings" DOUBLE PRECISION,
    "nominee" TEXT,
    "applicantSignature" TEXT,
    "approvalDate" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "savingsAccountNumber" TEXT,
    "managerSignature" TEXT,
    "cashierSignature" TEXT,
    "officialStamp" TEXT,
    "passportPhoto" TEXT,
    "idCopyPath" TEXT,
    "additionalDocs" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "fingerprintTemplate" TEXT,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "interestRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "interestPeriod" TEXT NOT NULL DEFAULT 'MONTHLY',
    "minBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "maxWithdrawal" DOUBLE PRECISION,
    "isLoanEligible" BOOLEAN NOT NULL DEFAULT true,
    "monthlyCharge" DOUBLE PRECISION,
    "withdrawalFeeTiers" TEXT,
    "flatWithdrawalFee" DOUBLE PRECISION,
    "withdrawalFrequencyDays" INTEGER,
    "maxWithdrawalsPerDay" INTEGER,
    "hasFixedPeriod" BOOLEAN NOT NULL DEFAULT false,
    "fixedPeriodMonths" INTEGER,
    "maturityTransferAccountType" TEXT,
    "isShareAccount" BOOLEAN NOT NULL DEFAULT false,
    "canWithdraw" BOOLEAN NOT NULL DEFAULT true,
    "earnsDividends" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "withdrawalFeePercentage" DOUBLE PRECISION,

    CONSTRAINT "AccountType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "memberId" TEXT,
    "institutionId" TEXT,
    "accountTypeId" TEXT NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "branchId" TEXT NOT NULL,
    "customFlatWithdrawalFee" DOUBLE PRECISION,
    "customWithdrawalFeePercentage" DOUBLE PRECISION,
    "customWithdrawalFeeTiers" TEXT,
    "isAutoGenerated" BOOLEAN NOT NULL DEFAULT true,
    "customNumberApprovedBy" TEXT,
    "customNumberApprovedAt" TIMESTAMP(3),

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "transactionRef" TEXT NOT NULL,
    "sourceMemberId" TEXT,
    "targetAccountId" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'UGX',
    "exchangeRate" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "description" TEXT,
    "transactionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valueDate" TIMESTAMP(3),
    "processedByUserId" TEXT,
    "branchId" TEXT,
    "customerId" TEXT,
    "loanId" TEXT,
    "scheduleId" TEXT,
    "paymentMethod" TEXT,
    "paymentReference" TEXT,
    "notes" TEXT,
    "relatedTransactionId" TEXT,
    "externalReference" TEXT,
    "channel" TEXT,
    "institutionId" TEXT,
    "creditAccountId" TEXT,
    "debitAccountId" TEXT,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deposit" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "memberId" TEXT,
    "accountId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "depositDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "handlerUserId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "mobileMoneyRef" TEXT,
    "depositorName" TEXT,
    "institutionId" TEXT,

    CONSTRAINT "Deposit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Withdrawal" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "memberId" TEXT,
    "accountId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "withdrawalDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "handlerUserId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "mobileMoneyRef" TEXT,
    "institutionId" TEXT,

    CONSTRAINT "Withdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WithdrawalVerification" (
    "id" TEXT NOT NULL,
    "memberId" TEXT,
    "accountId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "channel" TEXT NOT NULL,
    "mobileMoneyRef" TEXT,
    "description" TEXT,
    "verificationCode" TEXT NOT NULL,
    "handlerUserId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "smsSent" BOOLEAN NOT NULL DEFAULT false,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "institutionId" TEXT,
    "signatoryId" TEXT,

    CONSTRAINT "WithdrawalVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanProduct" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minAmount" DOUBLE PRECISION NOT NULL,
    "maxAmount" DOUBLE PRECISION NOT NULL,
    "interestRate" DOUBLE PRECISION NOT NULL,
    "repaymentPeriodDays" INTEGER NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoanProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanApplication" (
    "id" TEXT NOT NULL,
    "loanProductId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "loanOfficerId" TEXT,
    "amountApplied" DOUBLE PRECISION NOT NULL,
    "applicationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "LoanStatus" NOT NULL DEFAULT 'PENDING',
    "stage" "LoanStage" NOT NULL DEFAULT 'DRAFT',
    "purpose" TEXT,
    "applicantId" TEXT,
    "approverId" TEXT,
    "allocatedTellerId" TEXT,
    "employer" TEXT,
    "employmentStatus" TEXT,
    "grossMonthlyIncome" DOUBLE PRECISION,
    "netMonthlyIncome" DOUBLE PRECISION,
    "repaymentPeriodMonths" INTEGER,
    "repaymentStartDate" TIMESTAMP(3),
    "modeOfRepayment" TEXT,
    "collateralOffered" TEXT,
    "guarantors" JSONB,
    "appraisalScore" DOUBLE PRECISION,
    "debtToIncomeRatio" DOUBLE PRECISION,
    "recommendedAmount" DOUBLE PRECISION,
    "interestRateOverride" DOUBLE PRECISION,
    "decisionNotes" TEXT,
    "disbursementMethod" TEXT,
    "approvalDate" TIMESTAMP(3),
    "approvedAmount" DOUBLE PRECISION,
    "rejectionReason" TEXT,
    "forwardedAt" TIMESTAMP(3),
    "inAnalysisAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "disbursedAt" TIMESTAMP(3),
    "applicantDeclaration" BOOLEAN DEFAULT false,
    "applicantSignature" TEXT,
    "applicantSignatureDate" TIMESTAMP(3),
    "applyLoanInsurance" BOOLEAN DEFAULT false,
    "applyLoanProcessingFee" BOOLEAN DEFAULT false,
    "applyShareDeduction" BOOLEAN DEFAULT false,
    "bankAccountNumber" TEXT,
    "bankBranch" TEXT,
    "bankName" TEXT,
    "collateralDetails" TEXT,
    "collateralLocation" TEXT,
    "collateralType" TEXT,
    "collateralValue" DOUBLE PRECISION,
    "existingLoanBalance" DOUBLE PRECISION,
    "forcedSaleValue" DOUBLE PRECISION,
    "guarantorAgreementAccepted" BOOLEAN DEFAULT false,
    "guarantorSignatureDate" TIMESTAMP(3),
    "hasExistingLoanWithSacco" BOOLEAN DEFAULT false,
    "hasOtherLoansWithInstitutions" BOOLEAN DEFAULT false,
    "loanInsurancePercentage" DOUBLE PRECISION,
    "loanProcessingFeePercentage" DOUBLE PRECISION,
    "mobileMoneyNumber" TEXT,
    "otherLoanBalance" DOUBLE PRECISION,
    "otherLoanInstitutionName" TEXT,
    "otherLoanMonthlyInstallment" DOUBLE PRECISION,
    "otherMonthlyObligations" TEXT,
    "shareAmount" DOUBLE PRECISION,

    CONSTRAINT "LoanApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Loan" (
    "id" TEXT NOT NULL,
    "loanApplicationId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "amountGranted" DOUBLE PRECISION NOT NULL,
    "interestRate" DOUBLE PRECISION NOT NULL,
    "totalAmountDue" DOUBLE PRECISION NOT NULL,
    "amountPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "allocatedTellerId" TEXT,
    "outstandingBalance" DOUBLE PRECISION NOT NULL,
    "disbursementDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "LoanStatus" NOT NULL DEFAULT 'DISBURSED',
    "disbursedByUserId" TEXT NOT NULL,
    "disbursementMethod" TEXT,
    "branchId" TEXT,
    "isRescheduled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "interestAmount" DOUBLE PRECISION,

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanRepayment" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "repaymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "handlerUserId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "mobileMoneyRef" TEXT,

    CONSTRAINT "LoanRepayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanAppeal" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewerNotes" TEXT,

    CONSTRAINT "LoanAppeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserFloat" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastReconciliation" TIMESTAMP(3),
    "currentDayStarted" TIMESTAMP(3),
    "isActiveForDay" BOOLEAN NOT NULL DEFAULT false,
    "lastDayReconciled" TIMESTAMP(3),
    "canStartNewDay" BOOLEAN NOT NULL DEFAULT true,
    "pendingReconciliation" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "UserFloat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FloatTransaction" (
    "id" TEXT NOT NULL,
    "floatId" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,
    "relatedTransactionId" TEXT,
    "performedByUserId" TEXT NOT NULL,

    CONSTRAINT "FloatTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FloatAllocation" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "tellerAgentId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "allocationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "allocatedByUserId" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "FloatAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FloatReconciliation" (
    "id" TEXT NOT NULL,
    "floatId" TEXT NOT NULL,
    "reconciliationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualCash" DOUBLE PRECISION NOT NULL,
    "systemBalance" DOUBLE PRECISION NOT NULL,
    "difference" DOUBLE PRECISION NOT NULL,
    "isBalanced" BOOLEAN NOT NULL,
    "reconciledByUserId" TEXT NOT NULL,
    "status" "ReconciliationStatus" NOT NULL DEFAULT 'PENDING',
    "type" "ReconciliationType" NOT NULL DEFAULT 'REGULAR',
    "approvedByUserId" TEXT,
    "approvalDate" TIMESTAMP(3),
    "dayStart" TIMESTAMP(3),
    "dayEnd" TIMESTAMP(3),
    "notes" TEXT,
    "cashOnHand" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "floatReturned" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isEndOfDay" BOOLEAN NOT NULL DEFAULT false,
    "reconciliationType" TEXT NOT NULL DEFAULT 'REGULAR',
    "rejectionReason" TEXT,

    CONSTRAINT "FloatReconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Statement" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "userId" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pdfPath" TEXT,

    CONSTRAINT "Statement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncomeCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "CategoryKind" NOT NULL DEFAULT 'INCOME',
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncomeCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncomeRecord" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "recognitionBasis" "RecognitionBasis" NOT NULL DEFAULT 'CASH',
    "receivedByUserId" TEXT NOT NULL,
    "branchId" TEXT,
    "memberId" TEXT,
    "accountId" TEXT,
    "receiptNumber" TEXT,
    "referenceNumber" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "budgetCategoryId" TEXT,
    "externalRef" TEXT,
    "periodId" TEXT,
    "receiptNo" TEXT,
    "recordDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "depositorContact" TEXT,
    "depositorName" TEXT,

    CONSTRAINT "IncomeRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenditureCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "CategoryKind" NOT NULL DEFAULT 'EXPENSE',
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "code" TEXT,

    CONSTRAINT "ExpenditureCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenditureRecord" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "recognitionBasis" "RecognitionBasis" NOT NULL DEFAULT 'CASH',
    "submittedByUserId" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "approvalDate" TIMESTAMP(3),
    "branchId" TEXT,
    "receiptNumber" TEXT,
    "referenceNumber" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "budgetCategoryId" TEXT,
    "periodId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "basis" TEXT,
    "externalRef" TEXT,
    "payee" TEXT,
    "recordDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rejectionReason" TEXT,
    "voucherNo" TEXT,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "ExpenditureRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Budget" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "branchId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "kind" "CategoryKind" NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialPeriod" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "closedAt" TIMESTAMP(3),
    "closedByUserId" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuspenseAccount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "branchId" TEXT,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SuspenseAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuspenseTransaction" (
    "id" TEXT NOT NULL,
    "suspenseAccountId" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,
    "performedByUserId" TEXT NOT NULL,
    "referenceId" TEXT,
    "referenceType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING_INVESTIGATION',
    "resolvedAt" TIMESTAMP(3),
    "resolvedByUserId" TEXT,
    "resolutionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SuspenseTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashShortage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reportedByUserId" TEXT NOT NULL,
    "reconciliationId" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "investigationNotes" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByUserId" TEXT,
    "resolutionAction" TEXT,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashShortage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatementEmailLog" (
    "id" TEXT NOT NULL,
    "statementId" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StatementEmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Institution" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "institutionNumber" TEXT NOT NULL,
    "registrationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "institutionName" TEXT NOT NULL,
    "institutionType" TEXT NOT NULL,
    "registrationNumber" TEXT,
    "tinNumber" TEXT,
    "legalStatus" TEXT,
    "yearEstablished" INTEGER,
    "businessSector" TEXT,
    "numberOfEmployees" INTEGER,
    "majorObjective" TEXT,
    "majorActivities" TEXT,
    "founderNames" TEXT,
    "plotNumber" TEXT,
    "street" TEXT,
    "village" TEXT,
    "parish" TEXT,
    "subCounty" TEXT,
    "constituency" TEXT,
    "town" TEXT,
    "district" TEXT,
    "postalAddress" TEXT,
    "primaryContactPerson" TEXT NOT NULL,
    "primaryContactTitle" TEXT,
    "primaryContactPhone" TEXT NOT NULL,
    "primaryContactEmail" TEXT,
    "institutionPhone" TEXT NOT NULL,
    "institutionEmail" TEXT NOT NULL,
    "bankName" TEXT,
    "bankAccountNumber" TEXT,
    "accountTitle" TEXT,
    "accountType" TEXT,
    "operatingInstructions" TEXT,
    "signatoryChangeRules" TEXT,
    "administrators" JSONB,
    "entryFee" DOUBLE PRECISION,
    "initialDeposit" DOUBLE PRECISION,
    "approvalDate" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "approvedBySignature" TEXT,
    "cashierSignature" TEXT,
    "officialStamp" TEXT,
    "registrationCertPath" TEXT,
    "lcRecommendationPath" TEXT,
    "minutesPath" TEXT,
    "bylawsPath" TEXT,
    "additionalDocs" TEXT[],
    "withdrawalMandate" "WithdrawalMandate" DEFAULT 'ALL_SIGNATORIES',
    "withdrawalMandateText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Institution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstitutionSignatory" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "signatureImage" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstitutionSignatory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstitutionLoanApplication" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "loanProductId" TEXT NOT NULL,
    "amountApplied" DOUBLE PRECISION NOT NULL,
    "applicationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "LoanStatus" NOT NULL DEFAULT 'PENDING',
    "stage" "LoanStage" NOT NULL DEFAULT 'SUBMITTED',
    "purpose" TEXT,
    "repaymentPeriodMonths" INTEGER,
    "repaymentStartDate" TIMESTAMP(3),
    "collateralOffered" TEXT,
    "approvalDate" TIMESTAMP(3),
    "approvedAmount" DOUBLE PRECISION,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstitutionLoanApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstitutionLoan" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "amountGranted" DOUBLE PRECISION NOT NULL,
    "interestRate" DOUBLE PRECISION NOT NULL,
    "totalAmountDue" DOUBLE PRECISION NOT NULL,
    "amountPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "outstandingBalance" DOUBLE PRECISION NOT NULL,
    "disbursementDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "LoanStatus" NOT NULL DEFAULT 'DISBURSED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstitutionLoan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstitutionLoanRepayment" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "repaymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "channel" TEXT NOT NULL,
    "mobileMoneyRef" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstitutionLoanRepayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsuranceContribution" (
    "id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" "InsuranceContributionType" NOT NULL,
    "description" TEXT NOT NULL,
    "reference" TEXT,
    "memberId" TEXT,
    "accountId" TEXT NOT NULL,
    "loanApplicationId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsuranceContribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanRepaymentRequest" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "status" "RepaymentRequestStatus" NOT NULL DEFAULT 'PENDING',
    "approvalToken" TEXT NOT NULL,
    "smsCode" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "notes" TEXT,
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "smsSent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoanRepaymentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanWriteOff" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "amountDisbursed" DOUBLE PRECISION NOT NULL,
    "principalPaid" DOUBLE PRECISION NOT NULL,
    "interestPaid" DOUBLE PRECISION NOT NULL,
    "penaltyPaid" DOUBLE PRECISION NOT NULL,
    "totalPaid" DOUBLE PRECISION NOT NULL,
    "principalBalance" DOUBLE PRECISION NOT NULL,
    "interestBalance" DOUBLE PRECISION NOT NULL,
    "penaltyBalance" DOUBLE PRECISION NOT NULL,
    "totalBalance" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "minuteNumber" TEXT,
    "dateWrittenOff" TIMESTAMP(3),
    "requestedByUserId" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "status" "WriteOffStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "supportingDocs" TEXT[],
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoanWriteOff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "entryNumber" TEXT NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT NOT NULL,
    "reference" TEXT,
    "accountId" TEXT NOT NULL,
    "debitAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "creditAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "transactionId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountTransaction" (
    "id" TEXT NOT NULL,
    "transactionRef" TEXT NOT NULL,
    "debitAccountId" TEXT NOT NULL,
    "creditAccountId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "linkedTransactionId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavingsAccount" (
    "id" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "accountTypeId" TEXT NOT NULL,
    "branchId" TEXT,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "availableBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "holdAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "SavingsAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "isDormant" BOOLEAN NOT NULL DEFAULT false,
    "isOverdrawn" BOOLEAN NOT NULL DEFAULT false,
    "interestRate" DOUBLE PRECISION NOT NULL,
    "lastInterestDate" TIMESTAMP(3),
    "totalInterestPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "openedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedDate" TIMESTAMP(3),
    "lastTransactionDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavingsAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavingsTransaction" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "transactionType" "SavingsTransactionType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "balanceBefore" DOUBLE PRECISION NOT NULL,
    "balanceAfter" DOUBLE PRECISION NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valueDate" TIMESTAMP(3),
    "reference" TEXT,
    "description" TEXT,
    "tellerId" TEXT,
    "batchId" TEXT,
    "sessionId" TEXT,
    "isReversed" BOOLEAN NOT NULL DEFAULT false,
    "reversedDate" TIMESTAMP(3),
    "reversedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavingsTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShareAccount" (
    "id" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "accountTypeId" TEXT NOT NULL,
    "branchId" TEXT,
    "numberOfShares" INTEGER NOT NULL DEFAULT 0,
    "shareValue" DOUBLE PRECISION NOT NULL,
    "totalValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "SavingsAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "openedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedDate" TIMESTAMP(3),
    "lastTransactionDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShareAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShareTransaction" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "transactionType" "ShareTransactionType" NOT NULL,
    "shares" INTEGER NOT NULL,
    "shareValue" DOUBLE PRECISION NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "sharesBefore" INTEGER NOT NULL,
    "sharesAfter" INTEGER NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reference" TEXT,
    "description" TEXT,
    "tellerId" TEXT,
    "batchId" TEXT,
    "isReversed" BOOLEAN NOT NULL DEFAULT false,
    "reversedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShareTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FixedDeposit" (
    "id" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "branchId" TEXT,
    "principalAmount" DOUBLE PRECISION NOT NULL,
    "interestRate" DOUBLE PRECISION NOT NULL,
    "termMonths" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "maturityDate" TIMESTAMP(3) NOT NULL,
    "maturityAmount" DOUBLE PRECISION NOT NULL,
    "status" "FixedDepositStatus" NOT NULL DEFAULT 'ACTIVE',
    "isWithdrawn" BOOLEAN NOT NULL DEFAULT false,
    "withdrawnDate" TIMESTAMP(3),
    "withdrawnAmount" DOUBLE PRECISION,
    "isReversed" BOOLEAN NOT NULL DEFAULT false,
    "reversedDate" TIMESTAMP(3),
    "reversalReason" TEXT,
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "renewedToId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FixedDeposit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionBatch" (
    "id" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "batchType" TEXT NOT NULL,
    "totalTransactions" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "processedBy" TEXT NOT NULL,
    "processedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "BatchStatus" NOT NULL DEFAULT 'PENDING',
    "approvedBy" TEXT,
    "approvedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransactionBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionSession" (
    "id" TEXT NOT NULL,
    "sessionNumber" TEXT NOT NULL,
    "tellerId" TEXT NOT NULL,
    "branchId" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "openingCash" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "closingCash" DOUBLE PRECISION,
    "totalDeposits" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalWithdrawals" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalTransactions" INTEGER NOT NULL DEFAULT 0,
    "status" "SessionStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransactionSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FixedAsset" (
    "id" TEXT NOT NULL,
    "assetCode" TEXT NOT NULL,
    "assetName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "purchaseDate" TIMESTAMP(3) NOT NULL,
    "purchasePrice" DOUBLE PRECISION NOT NULL,
    "supplier" TEXT,
    "invoiceNumber" TEXT,
    "depreciationMethod" TEXT NOT NULL DEFAULT 'STRAIGHT_LINE',
    "depreciationRate" DOUBLE PRECISION NOT NULL,
    "usefulLifeYears" INTEGER NOT NULL,
    "salvageValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currentValue" DOUBLE PRECISION NOT NULL,
    "accumulatedDepreciation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "location" TEXT,
    "serialNumber" TEXT,
    "model" TEXT,
    "status" "AssetStatus" NOT NULL DEFAULT 'ACTIVE',
    "disposalDate" TIMESTAMP(3),
    "disposalAmount" DOUBLE PRECISION,
    "disposalMethod" TEXT,
    "disposalNotes" TEXT,
    "branchId" TEXT,
    "responsiblePersonId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FixedAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetDepreciation" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "depreciationAmount" DOUBLE PRECISION NOT NULL,
    "accumulatedDepreciation" DOUBLE PRECISION NOT NULL,
    "bookValue" DOUBLE PRECISION NOT NULL,
    "isPosted" BOOLEAN NOT NULL DEFAULT false,
    "postedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetDepreciation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetMaintenance" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "maintenanceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "maintenanceType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL,
    "performedBy" TEXT,
    "vendor" TEXT,
    "nextMaintenanceDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetMaintenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StandingOrder" (
    "id" TEXT NOT NULL,
    "referenceNumber" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "beneficiaryName" TEXT NOT NULL,
    "beneficiaryAccount" TEXT NOT NULL,
    "beneficiaryBank" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "frequency" "StandingOrderFrequency" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "nextExecutionDate" TIMESTAMP(3) NOT NULL,
    "lastExecutionDate" TIMESTAMP(3),
    "status" "StandingOrderStatus" NOT NULL DEFAULT 'ACTIVE',
    "executionCount" INTEGER NOT NULL DEFAULT 0,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StandingOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StandingOrderExecution" (
    "id" TEXT NOT NULL,
    "standingOrderId" TEXT NOT NULL,
    "executionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "failureReason" TEXT,
    "transactionRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StandingOrderExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsLog" (
    "id" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "memberId" TEXT,
    "smsType" "SmsType" NOT NULL,
    "message" TEXT NOT NULL,
    "status" "SmsStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "provider" TEXT,
    "messageId" TEXT,
    "cost" DOUBLE PRECISION,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerFeedback" (
    "id" TEXT NOT NULL,
    "memberId" TEXT,
    "feedbackType" "FeedbackType" NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'PENDING',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "submittedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedToId" TEXT,
    "resolvedDate" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolution" TEXT,
    "resolutionNotes" TEXT,
    "rating" INTEGER,
    "attachments" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BranchReserveAllocation" (
    "id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "floatAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sourceVaultId" TEXT NOT NULL,
    "targetVaultId" TEXT NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "type" "AllocationType" NOT NULL DEFAULT 'ALLOCATION',
    "allocatedByUserId" TEXT NOT NULL,
    "confirmedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmationDate" TIMESTAMP(3),
    "notes" TEXT,
    "physicalCashEntered" DOUBLE PRECISION,
    "physicalFloatEntered" DOUBLE PRECISION,

    CONSTRAINT "BranchReserveAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanReschedule" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "oldDueDate" TIMESTAMP(3) NOT NULL,
    "newDueDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "RescheduleStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "village" TEXT,
    "parish" TEXT,
    "county" TEXT,
    "spouseName" TEXT,
    "spouseContact" TEXT,
    "spouseNIN" TEXT,
    "rescheduleAmount" DOUBLE PRECISION,
    "reschedulePeriod" TEXT,
    "securityType" TEXT,
    "securityDescription" TEXT,
    "securityPurchasePrice" DOUBLE PRECISION,
    "securityCurrentPrice" DOUBLE PRECISION,
    "securityValuation" DOUBLE PRECISION,
    "forcedSaleValue" DOUBLE PRECISION,
    "guarantors" JSONB,
    "officerComment" TEXT,
    "managerComment" TEXT,
    "committeeComment" TEXT,
    "minuteNumber" TEXT,

    CONSTRAINT "LoanReschedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstitutionWithdrawal" (
    "id" TEXT NOT NULL,
    "withdrawalId" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "recipientIdNumber" TEXT,
    "recipientPhone" TEXT,
    "recipientRelation" TEXT,
    "tellerVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "verifiedByUserId" TEXT,
    "signatoryApprovals" JSONB NOT NULL,
    "mandateMet" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstitutionWithdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountHold" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "memberId" TEXT,
    "institutionId" TEXT,
    "reason" "HoldReason" NOT NULL DEFAULT 'MANUAL_HOLD',
    "reasonText" TEXT,
    "loanId" TEXT,
    "placedByUserId" TEXT NOT NULL,
    "liftedByUserId" TEXT,
    "placedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "liftedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "liftNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountHold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountNumberSequence" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    "prefix" TEXT,
    "format" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountNumberSequence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_nationalId_key" ON "User"("nationalId");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_name_key" ON "Branch"("name");

-- CreateIndex
CREATE INDEX "Branch_name_idx" ON "Branch"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Vault_name_key" ON "Vault"("name");

-- CreateIndex
CREATE INDEX "Vault_branchId_idx" ON "Vault"("branchId");

-- CreateIndex
CREATE INDEX "Vault_isActive_idx" ON "Vault"("isActive");

-- CreateIndex
CREATE INDEX "VaultTransaction_vaultId_idx" ON "VaultTransaction"("vaultId");

-- CreateIndex
CREATE INDEX "VaultTransaction_type_idx" ON "VaultTransaction"("type");

-- CreateIndex
CREATE INDEX "VaultTransaction_transactionDate_idx" ON "VaultTransaction"("transactionDate");

-- CreateIndex
CREATE INDEX "VaultReconciliation_vaultId_idx" ON "VaultReconciliation"("vaultId");

-- CreateIndex
CREATE INDEX "VaultReconciliation_reconciliationDate_idx" ON "VaultReconciliation"("reconciliationDate");

-- CreateIndex
CREATE INDEX "VaultReconciliation_status_idx" ON "VaultReconciliation"("status");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_type_idx" ON "Notification"("type");

-- CreateIndex
CREATE INDEX "Notification_sentAt_idx" ON "Notification"("sentAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_idx" ON "AuditLog"("entityType");

-- CreateIndex
CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_key_key" ON "ApiKey"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Member_userId_key" ON "Member"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Member_memberNumber_key" ON "Member"("memberNumber");

-- CreateIndex
CREATE INDEX "Member_memberNumber_idx" ON "Member"("memberNumber");

-- CreateIndex
CREATE INDEX "Member_registrationDate_idx" ON "Member"("registrationDate");

-- CreateIndex
CREATE INDEX "Member_userId_idx" ON "Member"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountType_name_key" ON "AccountType"("name");

-- CreateIndex
CREATE INDEX "AccountType_name_idx" ON "AccountType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Account_accountNumber_key" ON "Account"("accountNumber");

-- CreateIndex
CREATE INDEX "Account_accountNumber_idx" ON "Account"("accountNumber");

-- CreateIndex
CREATE INDEX "Account_memberId_idx" ON "Account"("memberId");

-- CreateIndex
CREATE INDEX "Account_institutionId_idx" ON "Account"("institutionId");

-- CreateIndex
CREATE INDEX "Account_accountTypeId_idx" ON "Account"("accountTypeId");

-- CreateIndex
CREATE INDEX "Account_branchId_idx" ON "Account"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_transactionRef_key" ON "Transaction"("transactionRef");

-- CreateIndex
CREATE INDEX "Transaction_sourceMemberId_idx" ON "Transaction"("sourceMemberId");

-- CreateIndex
CREATE INDEX "Transaction_targetAccountId_idx" ON "Transaction"("targetAccountId");

-- CreateIndex
CREATE INDEX "Transaction_type_idx" ON "Transaction"("type");

-- CreateIndex
CREATE INDEX "Transaction_transactionDate_idx" ON "Transaction"("transactionDate");

-- CreateIndex
CREATE INDEX "Transaction_status_idx" ON "Transaction"("status");

-- CreateIndex
CREATE INDEX "Transaction_institutionId_idx" ON "Transaction"("institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "Deposit_transactionId_key" ON "Deposit"("transactionId");

-- CreateIndex
CREATE INDEX "Deposit_memberId_idx" ON "Deposit"("memberId");

-- CreateIndex
CREATE INDEX "Deposit_handlerUserId_idx" ON "Deposit"("handlerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Withdrawal_transactionId_key" ON "Withdrawal"("transactionId");

-- CreateIndex
CREATE INDEX "Withdrawal_memberId_idx" ON "Withdrawal"("memberId");

-- CreateIndex
CREATE INDEX "Withdrawal_institutionId_idx" ON "Withdrawal"("institutionId");

-- CreateIndex
CREATE INDEX "Withdrawal_handlerUserId_idx" ON "Withdrawal"("handlerUserId");

-- CreateIndex
CREATE INDEX "WithdrawalVerification_memberId_idx" ON "WithdrawalVerification"("memberId");

-- CreateIndex
CREATE INDEX "WithdrawalVerification_institutionId_idx" ON "WithdrawalVerification"("institutionId");

-- CreateIndex
CREATE INDEX "WithdrawalVerification_accountId_idx" ON "WithdrawalVerification"("accountId");

-- CreateIndex
CREATE INDEX "WithdrawalVerification_handlerUserId_idx" ON "WithdrawalVerification"("handlerUserId");

-- CreateIndex
CREATE INDEX "WithdrawalVerification_verificationCode_idx" ON "WithdrawalVerification"("verificationCode");

-- CreateIndex
CREATE INDEX "WithdrawalVerification_expiresAt_idx" ON "WithdrawalVerification"("expiresAt");

-- CreateIndex
CREATE INDEX "WithdrawalVerification_isUsed_idx" ON "WithdrawalVerification"("isUsed");

-- CreateIndex
CREATE UNIQUE INDEX "LoanProduct_name_key" ON "LoanProduct"("name");

-- CreateIndex
CREATE INDEX "LoanProduct_name_idx" ON "LoanProduct"("name");

-- CreateIndex
CREATE INDEX "LoanApplication_memberId_idx" ON "LoanApplication"("memberId");

-- CreateIndex
CREATE INDEX "LoanApplication_loanProductId_idx" ON "LoanApplication"("loanProductId");

-- CreateIndex
CREATE INDEX "LoanApplication_status_idx" ON "LoanApplication"("status");

-- CreateIndex
CREATE INDEX "LoanApplication_stage_idx" ON "LoanApplication"("stage");

-- CreateIndex
CREATE UNIQUE INDEX "Loan_loanApplicationId_key" ON "Loan"("loanApplicationId");

-- CreateIndex
CREATE INDEX "Loan_memberId_idx" ON "Loan"("memberId");

-- CreateIndex
CREATE INDEX "Loan_status_idx" ON "Loan"("status");

-- CreateIndex
CREATE INDEX "Loan_disbursementDate_idx" ON "Loan"("disbursementDate");

-- CreateIndex
CREATE INDEX "LoanRepayment_loanId_idx" ON "LoanRepayment"("loanId");

-- CreateIndex
CREATE INDEX "LoanRepayment_memberId_idx" ON "LoanRepayment"("memberId");

-- CreateIndex
CREATE INDEX "LoanRepayment_repaymentDate_idx" ON "LoanRepayment"("repaymentDate");

-- CreateIndex
CREATE UNIQUE INDEX "UserFloat_userId_key" ON "UserFloat"("userId");

-- CreateIndex
CREATE INDEX "UserFloat_userId_idx" ON "UserFloat"("userId");

-- CreateIndex
CREATE INDEX "FloatTransaction_floatId_idx" ON "FloatTransaction"("floatId");

-- CreateIndex
CREATE INDEX "FloatTransaction_type_idx" ON "FloatTransaction"("type");

-- CreateIndex
CREATE INDEX "FloatTransaction_transactionDate_idx" ON "FloatTransaction"("transactionDate");

-- CreateIndex
CREATE INDEX "FloatAllocation_branchId_idx" ON "FloatAllocation"("branchId");

-- CreateIndex
CREATE INDEX "FloatAllocation_tellerAgentId_idx" ON "FloatAllocation"("tellerAgentId");

-- CreateIndex
CREATE INDEX "FloatAllocation_allocationDate_idx" ON "FloatAllocation"("allocationDate");

-- CreateIndex
CREATE INDEX "FloatReconciliation_floatId_idx" ON "FloatReconciliation"("floatId");

-- CreateIndex
CREATE INDEX "FloatReconciliation_reconciliationDate_idx" ON "FloatReconciliation"("reconciliationDate");

-- CreateIndex
CREATE INDEX "FloatReconciliation_status_idx" ON "FloatReconciliation"("status");

-- CreateIndex
CREATE INDEX "FloatReconciliation_isEndOfDay_idx" ON "FloatReconciliation"("isEndOfDay");

-- CreateIndex
CREATE INDEX "Statement_memberId_idx" ON "Statement"("memberId");

-- CreateIndex
CREATE INDEX "Statement_userId_idx" ON "Statement"("userId");

-- CreateIndex
CREATE INDEX "Statement_generatedAt_idx" ON "Statement"("generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "IncomeCategory_name_key" ON "IncomeCategory"("name");

-- CreateIndex
CREATE INDEX "IncomeCategory_name_idx" ON "IncomeCategory"("name");

-- CreateIndex
CREATE INDEX "IncomeCategory_kind_idx" ON "IncomeCategory"("kind");

-- CreateIndex
CREATE INDEX "IncomeRecord_categoryId_idx" ON "IncomeRecord"("categoryId");

-- CreateIndex
CREATE INDEX "IncomeRecord_budgetCategoryId_idx" ON "IncomeRecord"("budgetCategoryId");

-- CreateIndex
CREATE INDEX "IncomeRecord_date_idx" ON "IncomeRecord"("date");

-- CreateIndex
CREATE INDEX "IncomeRecord_recordDate_idx" ON "IncomeRecord"("recordDate");

-- CreateIndex
CREATE INDEX "IncomeRecord_receivedByUserId_idx" ON "IncomeRecord"("receivedByUserId");

-- CreateIndex
CREATE INDEX "IncomeRecord_branchId_idx" ON "IncomeRecord"("branchId");

-- CreateIndex
CREATE INDEX "IncomeRecord_memberId_idx" ON "IncomeRecord"("memberId");

-- CreateIndex
CREATE INDEX "IncomeRecord_periodId_idx" ON "IncomeRecord"("periodId");

-- CreateIndex
CREATE INDEX "IncomeRecord_status_idx" ON "IncomeRecord"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenditureCategory_name_key" ON "ExpenditureCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenditureCategory_code_key" ON "ExpenditureCategory"("code");

-- CreateIndex
CREATE INDEX "ExpenditureCategory_name_idx" ON "ExpenditureCategory"("name");

-- CreateIndex
CREATE INDEX "ExpenditureCategory_kind_idx" ON "ExpenditureCategory"("kind");

-- CreateIndex
CREATE INDEX "ExpenditureCategory_code_idx" ON "ExpenditureCategory"("code");

-- CreateIndex
CREATE INDEX "ExpenditureRecord_categoryId_idx" ON "ExpenditureRecord"("categoryId");

-- CreateIndex
CREATE INDEX "ExpenditureRecord_budgetCategoryId_idx" ON "ExpenditureRecord"("budgetCategoryId");

-- CreateIndex
CREATE INDEX "ExpenditureRecord_date_idx" ON "ExpenditureRecord"("date");

-- CreateIndex
CREATE INDEX "ExpenditureRecord_recordDate_idx" ON "ExpenditureRecord"("recordDate");

-- CreateIndex
CREATE INDEX "ExpenditureRecord_submittedByUserId_idx" ON "ExpenditureRecord"("submittedByUserId");

-- CreateIndex
CREATE INDEX "ExpenditureRecord_branchId_idx" ON "ExpenditureRecord"("branchId");

-- CreateIndex
CREATE INDEX "ExpenditureRecord_periodId_idx" ON "ExpenditureRecord"("periodId");

-- CreateIndex
CREATE INDEX "ExpenditureRecord_status_idx" ON "ExpenditureRecord"("status");

-- CreateIndex
CREATE INDEX "Budget_categoryId_idx" ON "Budget"("categoryId");

-- CreateIndex
CREATE INDEX "Budget_year_idx" ON "Budget"("year");

-- CreateIndex
CREATE INDEX "Budget_branchId_idx" ON "Budget"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "Budget_categoryId_year_branchId_key" ON "Budget"("categoryId", "year", "branchId");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetCategory_code_key" ON "BudgetCategory"("code");

-- CreateIndex
CREATE INDEX "BudgetCategory_kind_idx" ON "BudgetCategory"("kind");

-- CreateIndex
CREATE INDEX "BudgetCategory_parentId_idx" ON "BudgetCategory"("parentId");

-- CreateIndex
CREATE INDEX "BudgetCategory_isActive_idx" ON "BudgetCategory"("isActive");

-- CreateIndex
CREATE INDEX "BudgetCategory_code_idx" ON "BudgetCategory"("code");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetCategory_name_kind_parentId_key" ON "BudgetCategory"("name", "kind", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialPeriod_name_key" ON "FinancialPeriod"("name");

-- CreateIndex
CREATE INDEX "FinancialPeriod_startDate_idx" ON "FinancialPeriod"("startDate");

-- CreateIndex
CREATE INDEX "FinancialPeriod_endDate_idx" ON "FinancialPeriod"("endDate");

-- CreateIndex
CREATE INDEX "FinancialPeriod_isClosed_idx" ON "FinancialPeriod"("isClosed");

-- CreateIndex
CREATE UNIQUE INDEX "SuspenseAccount_name_key" ON "SuspenseAccount"("name");

-- CreateIndex
CREATE INDEX "SuspenseAccount_branchId_idx" ON "SuspenseAccount"("branchId");

-- CreateIndex
CREATE INDEX "SuspenseAccount_isActive_idx" ON "SuspenseAccount"("isActive");

-- CreateIndex
CREATE INDEX "SuspenseTransaction_suspenseAccountId_idx" ON "SuspenseTransaction"("suspenseAccountId");

-- CreateIndex
CREATE INDEX "SuspenseTransaction_type_idx" ON "SuspenseTransaction"("type");

-- CreateIndex
CREATE INDEX "SuspenseTransaction_transactionDate_idx" ON "SuspenseTransaction"("transactionDate");

-- CreateIndex
CREATE INDEX "SuspenseTransaction_status_idx" ON "SuspenseTransaction"("status");

-- CreateIndex
CREATE INDEX "SuspenseTransaction_referenceId_idx" ON "SuspenseTransaction"("referenceId");

-- CreateIndex
CREATE INDEX "CashShortage_userId_idx" ON "CashShortage"("userId");

-- CreateIndex
CREATE INDEX "CashShortage_reportedByUserId_idx" ON "CashShortage"("reportedByUserId");

-- CreateIndex
CREATE INDEX "CashShortage_reconciliationId_idx" ON "CashShortage"("reconciliationId");

-- CreateIndex
CREATE INDEX "CashShortage_status_idx" ON "CashShortage"("status");

-- CreateIndex
CREATE INDEX "CashShortage_reportedAt_idx" ON "CashShortage"("reportedAt");

-- CreateIndex
CREATE INDEX "StatementEmailLog_statementId_idx" ON "StatementEmailLog"("statementId");

-- CreateIndex
CREATE INDEX "StatementEmailLog_recipientEmail_idx" ON "StatementEmailLog"("recipientEmail");

-- CreateIndex
CREATE INDEX "StatementEmailLog_sentAt_idx" ON "StatementEmailLog"("sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "Institution_userId_key" ON "Institution"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Institution_institutionNumber_key" ON "Institution"("institutionNumber");

-- CreateIndex
CREATE INDEX "Institution_institutionNumber_idx" ON "Institution"("institutionNumber");

-- CreateIndex
CREATE INDEX "Institution_registrationDate_idx" ON "Institution"("registrationDate");

-- CreateIndex
CREATE INDEX "Institution_userId_idx" ON "Institution"("userId");

-- CreateIndex
CREATE INDEX "InstitutionSignatory_institutionId_idx" ON "InstitutionSignatory"("institutionId");

-- CreateIndex
CREATE INDEX "InstitutionLoanApplication_institutionId_idx" ON "InstitutionLoanApplication"("institutionId");

-- CreateIndex
CREATE INDEX "InstitutionLoanApplication_status_idx" ON "InstitutionLoanApplication"("status");

-- CreateIndex
CREATE INDEX "InstitutionLoanApplication_loanProductId_idx" ON "InstitutionLoanApplication"("loanProductId");

-- CreateIndex
CREATE INDEX "InstitutionLoanApplication_stage_idx" ON "InstitutionLoanApplication"("stage");

-- CreateIndex
CREATE INDEX "InstitutionLoanApplication_applicationDate_idx" ON "InstitutionLoanApplication"("applicationDate");

-- CreateIndex
CREATE UNIQUE INDEX "InstitutionLoan_applicationId_key" ON "InstitutionLoan"("applicationId");

-- CreateIndex
CREATE INDEX "InstitutionLoan_institutionId_idx" ON "InstitutionLoan"("institutionId");

-- CreateIndex
CREATE INDEX "InstitutionLoan_status_idx" ON "InstitutionLoan"("status");

-- CreateIndex
CREATE INDEX "InstitutionLoan_disbursementDate_idx" ON "InstitutionLoan"("disbursementDate");

-- CreateIndex
CREATE INDEX "InstitutionLoan_dueDate_idx" ON "InstitutionLoan"("dueDate");

-- CreateIndex
CREATE INDEX "InstitutionLoanRepayment_loanId_idx" ON "InstitutionLoanRepayment"("loanId");

-- CreateIndex
CREATE INDEX "InstitutionLoanRepayment_institutionId_idx" ON "InstitutionLoanRepayment"("institutionId");

-- CreateIndex
CREATE INDEX "InstitutionLoanRepayment_repaymentDate_idx" ON "InstitutionLoanRepayment"("repaymentDate");

-- CreateIndex
CREATE INDEX "InsuranceContribution_memberId_idx" ON "InsuranceContribution"("memberId");

-- CreateIndex
CREATE INDEX "InsuranceContribution_accountId_idx" ON "InsuranceContribution"("accountId");

-- CreateIndex
CREATE INDEX "InsuranceContribution_loanApplicationId_idx" ON "InsuranceContribution"("loanApplicationId");

-- CreateIndex
CREATE INDEX "InsuranceContribution_type_idx" ON "InsuranceContribution"("type");

-- CreateIndex
CREATE INDEX "InsuranceContribution_createdAt_idx" ON "InsuranceContribution"("createdAt");

-- CreateIndex
CREATE INDEX "InsuranceContribution_createdById_idx" ON "InsuranceContribution"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "LoanRepaymentRequest_approvalToken_key" ON "LoanRepaymentRequest"("approvalToken");

-- CreateIndex
CREATE INDEX "LoanRepaymentRequest_loanId_idx" ON "LoanRepaymentRequest"("loanId");

-- CreateIndex
CREATE INDEX "LoanRepaymentRequest_memberId_idx" ON "LoanRepaymentRequest"("memberId");

-- CreateIndex
CREATE INDEX "LoanRepaymentRequest_accountId_idx" ON "LoanRepaymentRequest"("accountId");

-- CreateIndex
CREATE INDEX "LoanRepaymentRequest_status_idx" ON "LoanRepaymentRequest"("status");

-- CreateIndex
CREATE INDEX "LoanRepaymentRequest_approvalToken_idx" ON "LoanRepaymentRequest"("approvalToken");

-- CreateIndex
CREATE INDEX "LoanRepaymentRequest_expiresAt_idx" ON "LoanRepaymentRequest"("expiresAt");

-- CreateIndex
CREATE INDEX "LoanWriteOff_loanId_idx" ON "LoanWriteOff"("loanId");

-- CreateIndex
CREATE INDEX "LoanWriteOff_status_idx" ON "LoanWriteOff"("status");

-- CreateIndex
CREATE INDEX "LoanWriteOff_requestedByUserId_idx" ON "LoanWriteOff"("requestedByUserId");

-- CreateIndex
CREATE INDEX "LoanWriteOff_approvedByUserId_idx" ON "LoanWriteOff"("approvedByUserId");

-- CreateIndex
CREATE INDEX "LoanWriteOff_requestedAt_idx" ON "LoanWriteOff"("requestedAt");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_entryNumber_key" ON "JournalEntry"("entryNumber");

-- CreateIndex
CREATE INDEX "JournalEntry_accountId_idx" ON "JournalEntry"("accountId");

-- CreateIndex
CREATE INDEX "JournalEntry_entryDate_idx" ON "JournalEntry"("entryDate");

-- CreateIndex
CREATE INDEX "JournalEntry_transactionId_idx" ON "JournalEntry"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountTransaction_transactionRef_key" ON "AccountTransaction"("transactionRef");

-- CreateIndex
CREATE INDEX "AccountTransaction_debitAccountId_idx" ON "AccountTransaction"("debitAccountId");

-- CreateIndex
CREATE INDEX "AccountTransaction_creditAccountId_idx" ON "AccountTransaction"("creditAccountId");

-- CreateIndex
CREATE INDEX "AccountTransaction_transactionDate_idx" ON "AccountTransaction"("transactionDate");

-- CreateIndex
CREATE UNIQUE INDEX "SavingsAccount_accountNumber_key" ON "SavingsAccount"("accountNumber");

-- CreateIndex
CREATE INDEX "SavingsAccount_memberId_idx" ON "SavingsAccount"("memberId");

-- CreateIndex
CREATE INDEX "SavingsAccount_accountNumber_idx" ON "SavingsAccount"("accountNumber");

-- CreateIndex
CREATE INDEX "SavingsAccount_status_idx" ON "SavingsAccount"("status");

-- CreateIndex
CREATE INDEX "SavingsAccount_isDormant_idx" ON "SavingsAccount"("isDormant");

-- CreateIndex
CREATE INDEX "SavingsAccount_branchId_idx" ON "SavingsAccount"("branchId");

-- CreateIndex
CREATE INDEX "SavingsTransaction_accountId_idx" ON "SavingsTransaction"("accountId");

-- CreateIndex
CREATE INDEX "SavingsTransaction_transactionDate_idx" ON "SavingsTransaction"("transactionDate");

-- CreateIndex
CREATE INDEX "SavingsTransaction_transactionType_idx" ON "SavingsTransaction"("transactionType");

-- CreateIndex
CREATE INDEX "SavingsTransaction_batchId_idx" ON "SavingsTransaction"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "ShareAccount_accountNumber_key" ON "ShareAccount"("accountNumber");

-- CreateIndex
CREATE INDEX "ShareAccount_memberId_idx" ON "ShareAccount"("memberId");

-- CreateIndex
CREATE INDEX "ShareAccount_accountNumber_idx" ON "ShareAccount"("accountNumber");

-- CreateIndex
CREATE INDEX "ShareAccount_status_idx" ON "ShareAccount"("status");

-- CreateIndex
CREATE INDEX "ShareAccount_branchId_idx" ON "ShareAccount"("branchId");

-- CreateIndex
CREATE INDEX "ShareTransaction_accountId_idx" ON "ShareTransaction"("accountId");

-- CreateIndex
CREATE INDEX "ShareTransaction_transactionDate_idx" ON "ShareTransaction"("transactionDate");

-- CreateIndex
CREATE INDEX "ShareTransaction_transactionType_idx" ON "ShareTransaction"("transactionType");

-- CreateIndex
CREATE UNIQUE INDEX "FixedDeposit_accountNumber_key" ON "FixedDeposit"("accountNumber");

-- CreateIndex
CREATE INDEX "FixedDeposit_memberId_idx" ON "FixedDeposit"("memberId");

-- CreateIndex
CREATE INDEX "FixedDeposit_accountNumber_idx" ON "FixedDeposit"("accountNumber");

-- CreateIndex
CREATE INDEX "FixedDeposit_status_idx" ON "FixedDeposit"("status");

-- CreateIndex
CREATE INDEX "FixedDeposit_maturityDate_idx" ON "FixedDeposit"("maturityDate");

-- CreateIndex
CREATE INDEX "FixedDeposit_branchId_idx" ON "FixedDeposit"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionBatch_batchNumber_key" ON "TransactionBatch"("batchNumber");

-- CreateIndex
CREATE INDEX "TransactionBatch_batchNumber_idx" ON "TransactionBatch"("batchNumber");

-- CreateIndex
CREATE INDEX "TransactionBatch_status_idx" ON "TransactionBatch"("status");

-- CreateIndex
CREATE INDEX "TransactionBatch_processedDate_idx" ON "TransactionBatch"("processedDate");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionSession_sessionNumber_key" ON "TransactionSession"("sessionNumber");

-- CreateIndex
CREATE INDEX "TransactionSession_tellerId_idx" ON "TransactionSession"("tellerId");

-- CreateIndex
CREATE INDEX "TransactionSession_sessionNumber_idx" ON "TransactionSession"("sessionNumber");

-- CreateIndex
CREATE INDEX "TransactionSession_status_idx" ON "TransactionSession"("status");

-- CreateIndex
CREATE INDEX "TransactionSession_openedAt_idx" ON "TransactionSession"("openedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FixedAsset_assetCode_key" ON "FixedAsset"("assetCode");

-- CreateIndex
CREATE INDEX "FixedAsset_assetCode_idx" ON "FixedAsset"("assetCode");

-- CreateIndex
CREATE INDEX "FixedAsset_category_idx" ON "FixedAsset"("category");

-- CreateIndex
CREATE INDEX "FixedAsset_status_idx" ON "FixedAsset"("status");

-- CreateIndex
CREATE INDEX "FixedAsset_purchaseDate_idx" ON "FixedAsset"("purchaseDate");

-- CreateIndex
CREATE INDEX "FixedAsset_branchId_idx" ON "FixedAsset"("branchId");

-- CreateIndex
CREATE INDEX "AssetDepreciation_assetId_idx" ON "AssetDepreciation"("assetId");

-- CreateIndex
CREATE INDEX "AssetDepreciation_periodYear_periodMonth_idx" ON "AssetDepreciation"("periodYear", "periodMonth");

-- CreateIndex
CREATE UNIQUE INDEX "AssetDepreciation_assetId_periodYear_periodMonth_key" ON "AssetDepreciation"("assetId", "periodYear", "periodMonth");

-- CreateIndex
CREATE INDEX "AssetMaintenance_assetId_idx" ON "AssetMaintenance"("assetId");

-- CreateIndex
CREATE INDEX "AssetMaintenance_maintenanceDate_idx" ON "AssetMaintenance"("maintenanceDate");

-- CreateIndex
CREATE UNIQUE INDEX "StandingOrder_referenceNumber_key" ON "StandingOrder"("referenceNumber");

-- CreateIndex
CREATE INDEX "StandingOrder_accountId_idx" ON "StandingOrder"("accountId");

-- CreateIndex
CREATE INDEX "StandingOrder_status_idx" ON "StandingOrder"("status");

-- CreateIndex
CREATE INDEX "StandingOrder_nextExecutionDate_idx" ON "StandingOrder"("nextExecutionDate");

-- CreateIndex
CREATE INDEX "StandingOrder_referenceNumber_idx" ON "StandingOrder"("referenceNumber");

-- CreateIndex
CREATE INDEX "StandingOrderExecution_standingOrderId_idx" ON "StandingOrderExecution"("standingOrderId");

-- CreateIndex
CREATE INDEX "StandingOrderExecution_executionDate_idx" ON "StandingOrderExecution"("executionDate");

-- CreateIndex
CREATE INDEX "StandingOrderExecution_status_idx" ON "StandingOrderExecution"("status");

-- CreateIndex
CREATE INDEX "SmsLog_phoneNumber_idx" ON "SmsLog"("phoneNumber");

-- CreateIndex
CREATE INDEX "SmsLog_memberId_idx" ON "SmsLog"("memberId");

-- CreateIndex
CREATE INDEX "SmsLog_smsType_idx" ON "SmsLog"("smsType");

-- CreateIndex
CREATE INDEX "SmsLog_status_idx" ON "SmsLog"("status");

-- CreateIndex
CREATE INDEX "SmsLog_sentAt_idx" ON "SmsLog"("sentAt");

-- CreateIndex
CREATE INDEX "CustomerFeedback_memberId_idx" ON "CustomerFeedback"("memberId");

-- CreateIndex
CREATE INDEX "CustomerFeedback_feedbackType_idx" ON "CustomerFeedback"("feedbackType");

-- CreateIndex
CREATE INDEX "CustomerFeedback_status_idx" ON "CustomerFeedback"("status");

-- CreateIndex
CREATE INDEX "CustomerFeedback_submittedDate_idx" ON "CustomerFeedback"("submittedDate");

-- CreateIndex
CREATE INDEX "CustomerFeedback_assignedToId_idx" ON "CustomerFeedback"("assignedToId");

-- CreateIndex
CREATE INDEX "BranchReserveAllocation_sourceVaultId_idx" ON "BranchReserveAllocation"("sourceVaultId");

-- CreateIndex
CREATE INDEX "BranchReserveAllocation_targetVaultId_idx" ON "BranchReserveAllocation"("targetVaultId");

-- CreateIndex
CREATE INDEX "BranchReserveAllocation_status_idx" ON "BranchReserveAllocation"("status");

-- CreateIndex
CREATE INDEX "LoanReschedule_loanId_idx" ON "LoanReschedule"("loanId");

-- CreateIndex
CREATE INDEX "LoanReschedule_status_idx" ON "LoanReschedule"("status");

-- CreateIndex
CREATE UNIQUE INDEX "InstitutionWithdrawal_withdrawalId_key" ON "InstitutionWithdrawal"("withdrawalId");

-- CreateIndex
CREATE INDEX "InstitutionWithdrawal_institutionId_idx" ON "InstitutionWithdrawal"("institutionId");

-- CreateIndex
CREATE INDEX "InstitutionWithdrawal_withdrawalId_idx" ON "InstitutionWithdrawal"("withdrawalId");

-- CreateIndex
CREATE INDEX "InstitutionWithdrawal_tellerVerified_idx" ON "InstitutionWithdrawal"("tellerVerified");

-- CreateIndex
CREATE INDEX "AccountHold_accountId_isActive_idx" ON "AccountHold"("accountId", "isActive");

-- CreateIndex
CREATE INDEX "AccountHold_memberId_idx" ON "AccountHold"("memberId");

-- CreateIndex
CREATE INDEX "AccountHold_institutionId_idx" ON "AccountHold"("institutionId");

-- CreateIndex
CREATE INDEX "AccountHold_loanId_idx" ON "AccountHold"("loanId");

-- CreateIndex
CREATE INDEX "AccountHold_placedByUserId_idx" ON "AccountHold"("placedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountNumberSequence_year_key" ON "AccountNumberSequence"("year");

-- CreateIndex
CREATE UNIQUE INDEX "ChartOfAccount_fullCode_key" ON "ChartOfAccount"("fullCode");

-- CreateIndex
CREATE INDEX "ChartOfAccount_ledgerType_idx" ON "ChartOfAccount"("ledgerType");

-- CreateIndex
CREATE INDEX "ChartOfAccount_isActive_idx" ON "ChartOfAccount"("isActive");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_accountantId_fkey" FOREIGN KEY ("accountantId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vault" ADD CONSTRAINT "Vault_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vault" ADD CONSTRAINT "Vault_custodianUserId_fkey" FOREIGN KEY ("custodianUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultTransaction" ADD CONSTRAINT "VaultTransaction_performedByUserId_fkey" FOREIGN KEY ("performedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultTransaction" ADD CONSTRAINT "VaultTransaction_relatedUserId_fkey" FOREIGN KEY ("relatedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultTransaction" ADD CONSTRAINT "VaultTransaction_vaultId_fkey" FOREIGN KEY ("vaultId") REFERENCES "Vault"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultReconciliation" ADD CONSTRAINT "VaultReconciliation_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultReconciliation" ADD CONSTRAINT "VaultReconciliation_reconciledByUserId_fkey" FOREIGN KEY ("reconciledByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultReconciliation" ADD CONSTRAINT "VaultReconciliation_vaultId_fkey" FOREIGN KEY ("vaultId") REFERENCES "Vault"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_accountTypeId_fkey" FOREIGN KEY ("accountTypeId") REFERENCES "AccountType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_creditAccountId_fkey" FOREIGN KEY ("creditAccountId") REFERENCES "ChartOfAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_debitAccountId_fkey" FOREIGN KEY ("debitAccountId") REFERENCES "ChartOfAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_processedByUserId_fkey" FOREIGN KEY ("processedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_sourceMemberId_fkey" FOREIGN KEY ("sourceMemberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_targetAccountId_fkey" FOREIGN KEY ("targetAccountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deposit" ADD CONSTRAINT "Deposit_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deposit" ADD CONSTRAINT "Deposit_handlerUserId_fkey" FOREIGN KEY ("handlerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deposit" ADD CONSTRAINT "Deposit_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deposit" ADD CONSTRAINT "Deposit_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deposit" ADD CONSTRAINT "Deposit_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_handlerUserId_fkey" FOREIGN KEY ("handlerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WithdrawalVerification" ADD CONSTRAINT "WithdrawalVerification_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WithdrawalVerification" ADD CONSTRAINT "WithdrawalVerification_handlerUserId_fkey" FOREIGN KEY ("handlerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WithdrawalVerification" ADD CONSTRAINT "WithdrawalVerification_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WithdrawalVerification" ADD CONSTRAINT "WithdrawalVerification_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WithdrawalVerification" ADD CONSTRAINT "WithdrawalVerification_signatoryId_fkey" FOREIGN KEY ("signatoryId") REFERENCES "InstitutionSignatory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanApplication" ADD CONSTRAINT "LoanApplication_allocatedTellerId_fkey" FOREIGN KEY ("allocatedTellerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanApplication" ADD CONSTRAINT "LoanApplication_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanApplication" ADD CONSTRAINT "LoanApplication_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanApplication" ADD CONSTRAINT "LoanApplication_loanOfficerId_fkey" FOREIGN KEY ("loanOfficerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanApplication" ADD CONSTRAINT "LoanApplication_loanProductId_fkey" FOREIGN KEY ("loanProductId") REFERENCES "LoanProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanApplication" ADD CONSTRAINT "LoanApplication_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_allocatedTellerId_fkey" FOREIGN KEY ("allocatedTellerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_disbursedByUserId_fkey" FOREIGN KEY ("disbursedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_loanApplicationId_fkey" FOREIGN KEY ("loanApplicationId") REFERENCES "LoanApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanRepayment" ADD CONSTRAINT "LoanRepayment_handlerUserId_fkey" FOREIGN KEY ("handlerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanRepayment" ADD CONSTRAINT "LoanRepayment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanRepayment" ADD CONSTRAINT "LoanRepayment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanAppeal" ADD CONSTRAINT "LoanAppeal_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "LoanApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanAppeal" ADD CONSTRAINT "LoanAppeal_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFloat" ADD CONSTRAINT "UserFloat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FloatTransaction" ADD CONSTRAINT "FloatTransaction_floatId_fkey" FOREIGN KEY ("floatId") REFERENCES "UserFloat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FloatTransaction" ADD CONSTRAINT "FloatTransaction_performedByUserId_fkey" FOREIGN KEY ("performedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FloatAllocation" ADD CONSTRAINT "FloatAllocation_allocatedByUserId_fkey" FOREIGN KEY ("allocatedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FloatAllocation" ADD CONSTRAINT "FloatAllocation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FloatAllocation" ADD CONSTRAINT "FloatAllocation_tellerAgentId_fkey" FOREIGN KEY ("tellerAgentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FloatReconciliation" ADD CONSTRAINT "FloatReconciliation_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FloatReconciliation" ADD CONSTRAINT "FloatReconciliation_floatId_fkey" FOREIGN KEY ("floatId") REFERENCES "UserFloat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FloatReconciliation" ADD CONSTRAINT "FloatReconciliation_reconciledByUserId_fkey" FOREIGN KEY ("reconciledByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Statement" ADD CONSTRAINT "Statement_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Statement" ADD CONSTRAINT "Statement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomeRecord" ADD CONSTRAINT "IncomeRecord_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomeRecord" ADD CONSTRAINT "IncomeRecord_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomeRecord" ADD CONSTRAINT "IncomeRecord_budgetCategoryId_fkey" FOREIGN KEY ("budgetCategoryId") REFERENCES "BudgetCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomeRecord" ADD CONSTRAINT "IncomeRecord_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "IncomeCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomeRecord" ADD CONSTRAINT "IncomeRecord_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomeRecord" ADD CONSTRAINT "IncomeRecord_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "FinancialPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomeRecord" ADD CONSTRAINT "IncomeRecord_receivedByUserId_fkey" FOREIGN KEY ("receivedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenditureRecord" ADD CONSTRAINT "ExpenditureRecord_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenditureRecord" ADD CONSTRAINT "ExpenditureRecord_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenditureRecord" ADD CONSTRAINT "ExpenditureRecord_budgetCategoryId_fkey" FOREIGN KEY ("budgetCategoryId") REFERENCES "BudgetCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenditureRecord" ADD CONSTRAINT "ExpenditureRecord_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenditureCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenditureRecord" ADD CONSTRAINT "ExpenditureRecord_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "FinancialPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenditureRecord" ADD CONSTRAINT "ExpenditureRecord_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "BudgetCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetCategory" ADD CONSTRAINT "BudgetCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "BudgetCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuspenseAccount" ADD CONSTRAINT "SuspenseAccount_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuspenseTransaction" ADD CONSTRAINT "SuspenseTransaction_performedByUserId_fkey" FOREIGN KEY ("performedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuspenseTransaction" ADD CONSTRAINT "SuspenseTransaction_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuspenseTransaction" ADD CONSTRAINT "SuspenseTransaction_suspenseAccountId_fkey" FOREIGN KEY ("suspenseAccountId") REFERENCES "SuspenseAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashShortage" ADD CONSTRAINT "CashShortage_reportedByUserId_fkey" FOREIGN KEY ("reportedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashShortage" ADD CONSTRAINT "CashShortage_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashShortage" ADD CONSTRAINT "CashShortage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatementEmailLog" ADD CONSTRAINT "StatementEmailLog_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "Statement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Institution" ADD CONSTRAINT "Institution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionSignatory" ADD CONSTRAINT "InstitutionSignatory_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionLoanApplication" ADD CONSTRAINT "InstitutionLoanApplication_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionLoanApplication" ADD CONSTRAINT "InstitutionLoanApplication_loanProductId_fkey" FOREIGN KEY ("loanProductId") REFERENCES "LoanProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionLoan" ADD CONSTRAINT "InstitutionLoan_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "InstitutionLoanApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionLoan" ADD CONSTRAINT "InstitutionLoan_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionLoanRepayment" ADD CONSTRAINT "InstitutionLoanRepayment_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionLoanRepayment" ADD CONSTRAINT "InstitutionLoanRepayment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "InstitutionLoan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceContribution" ADD CONSTRAINT "InsuranceContribution_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceContribution" ADD CONSTRAINT "InsuranceContribution_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceContribution" ADD CONSTRAINT "InsuranceContribution_loanApplicationId_fkey" FOREIGN KEY ("loanApplicationId") REFERENCES "LoanApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceContribution" ADD CONSTRAINT "InsuranceContribution_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanRepaymentRequest" ADD CONSTRAINT "LoanRepaymentRequest_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanRepaymentRequest" ADD CONSTRAINT "LoanRepaymentRequest_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanRepaymentRequest" ADD CONSTRAINT "LoanRepaymentRequest_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanRepaymentRequest" ADD CONSTRAINT "LoanRepaymentRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanWriteOff" ADD CONSTRAINT "LoanWriteOff_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanWriteOff" ADD CONSTRAINT "LoanWriteOff_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanWriteOff" ADD CONSTRAINT "LoanWriteOff_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ChartOfAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountTransaction" ADD CONSTRAINT "AccountTransaction_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountTransaction" ADD CONSTRAINT "AccountTransaction_creditAccountId_fkey" FOREIGN KEY ("creditAccountId") REFERENCES "ChartOfAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountTransaction" ADD CONSTRAINT "AccountTransaction_debitAccountId_fkey" FOREIGN KEY ("debitAccountId") REFERENCES "ChartOfAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountTransaction" ADD CONSTRAINT "AccountTransaction_linkedTransactionId_fkey" FOREIGN KEY ("linkedTransactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingsAccount" ADD CONSTRAINT "SavingsAccount_accountTypeId_fkey" FOREIGN KEY ("accountTypeId") REFERENCES "AccountType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingsAccount" ADD CONSTRAINT "SavingsAccount_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingsAccount" ADD CONSTRAINT "SavingsAccount_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingsTransaction" ADD CONSTRAINT "SavingsTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SavingsAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingsTransaction" ADD CONSTRAINT "SavingsTransaction_tellerId_fkey" FOREIGN KEY ("tellerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareAccount" ADD CONSTRAINT "ShareAccount_accountTypeId_fkey" FOREIGN KEY ("accountTypeId") REFERENCES "AccountType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareAccount" ADD CONSTRAINT "ShareAccount_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareAccount" ADD CONSTRAINT "ShareAccount_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareTransaction" ADD CONSTRAINT "ShareTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ShareAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareTransaction" ADD CONSTRAINT "ShareTransaction_tellerId_fkey" FOREIGN KEY ("tellerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedDeposit" ADD CONSTRAINT "FixedDeposit_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedDeposit" ADD CONSTRAINT "FixedDeposit_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionBatch" ADD CONSTRAINT "TransactionBatch_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionBatch" ADD CONSTRAINT "TransactionBatch_processedBy_fkey" FOREIGN KEY ("processedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionSession" ADD CONSTRAINT "TransactionSession_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionSession" ADD CONSTRAINT "TransactionSession_tellerId_fkey" FOREIGN KEY ("tellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_responsiblePersonId_fkey" FOREIGN KEY ("responsiblePersonId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetDepreciation" ADD CONSTRAINT "AssetDepreciation_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "FixedAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetMaintenance" ADD CONSTRAINT "AssetMaintenance_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "FixedAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StandingOrder" ADD CONSTRAINT "StandingOrder_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SavingsAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StandingOrder" ADD CONSTRAINT "StandingOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StandingOrderExecution" ADD CONSTRAINT "StandingOrderExecution_standingOrderId_fkey" FOREIGN KEY ("standingOrderId") REFERENCES "StandingOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsLog" ADD CONSTRAINT "SmsLog_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerFeedback" ADD CONSTRAINT "CustomerFeedback_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerFeedback" ADD CONSTRAINT "CustomerFeedback_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerFeedback" ADD CONSTRAINT "CustomerFeedback_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchReserveAllocation" ADD CONSTRAINT "BranchReserveAllocation_sourceVaultId_fkey" FOREIGN KEY ("sourceVaultId") REFERENCES "Vault"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchReserveAllocation" ADD CONSTRAINT "BranchReserveAllocation_targetVaultId_fkey" FOREIGN KEY ("targetVaultId") REFERENCES "Vault"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchReserveAllocation" ADD CONSTRAINT "BranchReserveAllocation_allocatedByUserId_fkey" FOREIGN KEY ("allocatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchReserveAllocation" ADD CONSTRAINT "BranchReserveAllocation_confirmedByUserId_fkey" FOREIGN KEY ("confirmedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanReschedule" ADD CONSTRAINT "LoanReschedule_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanReschedule" ADD CONSTRAINT "LoanReschedule_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanReschedule" ADD CONSTRAINT "LoanReschedule_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionWithdrawal" ADD CONSTRAINT "InstitutionWithdrawal_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionWithdrawal" ADD CONSTRAINT "InstitutionWithdrawal_verifiedByUserId_fkey" FOREIGN KEY ("verifiedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionWithdrawal" ADD CONSTRAINT "InstitutionWithdrawal_withdrawalId_fkey" FOREIGN KEY ("withdrawalId") REFERENCES "Withdrawal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountHold" ADD CONSTRAINT "AccountHold_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountHold" ADD CONSTRAINT "AccountHold_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountHold" ADD CONSTRAINT "AccountHold_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountHold" ADD CONSTRAINT "AccountHold_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountHold" ADD CONSTRAINT "AccountHold_placedByUserId_fkey" FOREIGN KEY ("placedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountHold" ADD CONSTRAINT "AccountHold_liftedByUserId_fkey" FOREIGN KEY ("liftedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
