import { db } from "@/prisma/db";

export class LookupService {
  /**
   * Get members with active accounts
   */
  static async getMembersWithActiveAccounts() {
    try {
      const members = await db.member.findMany({
        where: {
          accounts: { some: { status: "ACTIVE" } },
        },
        select: {
          id: true,
          memberNumber: true,
          user: {
            select: { id: true, name: true, email: true, phone: true, image: true },
          },
          accounts: {
            where: { status: "ACTIVE" },
            select: {
              id: true,
              accountNumber: true,
              branch: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { user: { name: "asc" } },
      });
      return { ok: true, data: members };
    } catch (error: any) {
      return { ok: false, error: error.message };
    }
  }

  /**
   * Get institutions with active accounts
   */
  static async getInstitutionsWithActiveAccounts() {
    try {
      const institutions = await db.institution.findMany({
        where: {
          accounts: { some: { status: "ACTIVE" } },
        },
        select: {
          id: true,
          institutionNumber: true,
          institutionName: true,
          institutionType: true,
          institutionEmail: true,
          institutionPhone: true,
          accounts: {
            where: { status: "ACTIVE" },
            select: {
              id: true,
              accountNumber: true,
              branch: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { institutionName: "asc" },
      });
      return { ok: true, data: institutions };
    } catch (error: any) {
      return { ok: false, error: error.message };
    }
  }

  /**
   * Get member's active accounts
   */
  static async getMemberActiveAccounts(memberId: string) {
    try {
      const accounts = await db.account.findMany({
        where: { memberId, status: "ACTIVE" },
        select: {
          id: true,
          accountNumber: true,
          balance: true,
          customFlatWithdrawalFee: true,
          customWithdrawalFeePercentage: true,
          accountType: {
            select: {
              id: true,
              name: true,
              minBalance: true,
              flatWithdrawalFee: true,
              withdrawalFeePercentage: true,
            },
          },
          branch: {
            select: { id: true, name: true, location: true },
          },
        },
        orderBy: { openedAt: "desc" },
      });
      return { ok: true, data: accounts };
    } catch (error: any) {
      return { ok: false, error: error.message };
    }
  }

  /**
   * Get institution's active accounts
   */
  static async getInstitutionActiveAccounts(institutionId: string) {
    try {
      const accounts = await db.account.findMany({
        where: { institutionId, status: "ACTIVE" },
        select: {
          id: true,
          accountNumber: true,
          balance: true,
          accountType: {
            select: { id: true, name: true, minBalance: true },
          },
          branch: {
            select: { id: true, name: true, location: true },
          },
        },
        orderBy: { openedAt: "desc" },
      });
      return { ok: true, data: accounts };
    } catch (error: any) {
      return { ok: false, error: error.message };
    }
  }

  /**
   * Get all members
   */
  static async getAllMembers() {
    try {
      const data = await db.member.findMany({
        include: { user: true, accounts: { include: { accountType: true } } },
        orderBy: { memberNumber: "asc" },
      });
      return { ok: true, data };
    } catch (error: any) {
      return { ok: false, error: error.message };
    }
  }

  /**
   * Get all branches
   */
  static async getAllBranches() {
    try {
      const data = await db.branch.findMany({
        orderBy: { name: "asc" },
      });
      return { ok: true, data };
    } catch (error: any) {
      return { ok: false, error: error.message };
    }
  }

  /**
   * Get all institutions with user details
   */
  static async getAllInstitutions() {
    try {
      const institutions = await db.institution.findMany({
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              isActive: true,
              role: true,
              createdAt: true,
              branchId: true,
              branch: { select: { name: true } },
            },
          },
        },
        orderBy: { institutionName: "asc" },
      });
      return { ok: true, data: institutions };
    } catch (error: any) {
      return { ok: false, error: error.message };
    }
  }

  /**
   * Get institutions eligible for account creation
   */
  static async getEligibleInstitutionsForAccountCreation(branchId?: string | null) {
    try {
      const where: any = {
        isApproved: true,
        user: {
          isActive: true,
          ...(branchId ? { branchId } : {}),
        },
        primaryContactPerson: { not: "" },
        primaryContactPhone: { not: "" },
        institutionPhone: { not: "" },
        institutionEmail: { not: "" },
        signatories: {
          some: {
            status: "ACTIVE",
            signatureImage: { not: null },
            phone: { not: "" },
          },
        },
      };

      const institutions = await db.institution.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              isActive: true,
              role: true,
              branchId: true,
              branch: { select: { name: true } },
            },
          },
          signatories: {
            select: {
              id: true,
              name: true,
              title: true,
              phone: true,
              email: true,
              signatureImage: true,
              status: true,
            },
          },
          accounts: {
            where: { status: "ACTIVE" },
            select: {
              id: true,
              accountNumber: true,
              balance: true,
              accountType: {
                select: { name: true },
              },
              branch: {
                select: { id: true, name: true, location: true },
              },
            },
          },
        },
        orderBy: { institutionName: "asc" },
      });

      return { ok: true, data: institutions };
    } catch (error: any) {
      return { ok: false, error: error.message };
    }
  }
}
