// @ts-nocheck
// ==============================================
// FILE: actions/institutions.ts - COMPLETE VERSION
// ==============================================

"use server";

import { db } from "@/prisma/db";
import bcrypt from "bcryptjs";
import { getAuthUser } from "@/config/useAuth";
import { UserRole, TransactionType, TransactionStatus, DepositType, AccountStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { startOfDay, endOfDay } from "date-fns";

interface Administrator {
  name: string;
  post: string;
  phone: string;
}

interface InstitutionData {
  // Basic Information
  institutionName: string;
  institutionType: string;
  registrationNumber?: string;
  tinNumber?: string;
  legalStatus?: string;
  yearEstablished?: string;
  businessSector?: string;
  numberOfEmployees?: string;
  majorObjective?: string;
  majorActivities?: string;
  founderNames?: string;

  // Location
  plotNumber?: string;
  street?: string;
  village?: string;
  parish?: string;
  subCounty?: string;
  constituency?: string;
  town?: string;
  district?: string;
  postalAddress?: string;

  // Contact
  primaryContactPerson: string;
  primaryContactTitle?: string;
  primaryContactPhone: string;
  primaryContactEmail?: string;
  institutionPhone: string;
  institutionEmail: string;

  // Account Details
  accountTitle?: string;
  accountType?: string;
  operatingInstructions?: string;
  signatoryChangeRules?: string;

  // Banking
  bankName?: string;
  bankAccountNumber?: string;

  // Financial
  entryFee?: string;
  initialDeposit?: string;

  // Branch
  branchId: string;

  // Password
  password: string;

  // Administrators
  administrators: Administrator[];
}

export async function createInstitution(data: InstitutionData) {
  try {
    const currentUser = await getAuthUser();

    if (!currentUser) {
      return {
        error: "Unauthorized. Please login.",
        data: null,
      };
    }

    // Check permissions
    const allowedRoles: UserRole[] = [UserRole.ADMIN, UserRole.BRANCHMANAGER, UserRole.DATA_ENTRANT];
    if (!allowedRoles.includes(currentUser.role as UserRole)) {
      return {
        error: "You don't have permission to register institutions",
        data: null,
      };
    }

    // Validate required fields
    if (!data.institutionName || !data.institutionType) {
      return {
        error: "Institution name and type are required",
        data: null,
      };
    }

    if (!data.institutionEmail || !data.institutionPhone) {
      return {
        error: "Institution email and phone are required",
        data: null,
      };
    }

    if (!data.primaryContactPerson || !data.primaryContactPhone) {
      return {
        error: "Primary contact person and phone are required",
        data: null,
      };
    }

    if (!data.branchId) {
      return {
        error: "Branch selection is required",
        data: null,
      };
    }

    // Check if email already exists
    const existingEmail = await db.user.findUnique({
      where: { email: data.institutionEmail },
    });

    if (existingEmail) {
      return {
        error: "Email address is already registered",
        data: null,
      };
    }

    // Check if phone already exists
    if (data.institutionPhone) {
      const existingPhone = await db.user.findUnique({
        where: { phone: data.institutionPhone },
      });

      if (existingPhone) {
        return {
          error: "Phone number is already registered",
          data: null,
        };
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Generate institution number
    const institutionCount = await db.institution.count();
    const institutionNumber = `INST${String(institutionCount + 1).padStart(6, "0")}`;

    // Create user and institution in a transaction
    const result = await db.$transaction(async (tx) => {
      const administrators = Array.isArray(data.administrators)
        ? data.administrators
        : [];

      // Create User
      const user = await tx.user.create({
        data: {
          firstName: data.institutionName,
          lastName: data.institutionType,
          name: data.institutionName,
          email: data.institutionEmail,
          phone: data.institutionPhone,
          password: hashedPassword,
          role: UserRole.INSTITUTION,
          branchId: data.branchId,
          isActive: false,
          isVerified: false,
          requiresPasswordChange: true,
        },
      });

      // Create Institution
      const institution = await tx.institution.create({
        data: {
          userId: user.id,
          institutionNumber,
          isApproved: false,

          // Basic Information
          institutionName: data.institutionName,
          institutionType: data.institutionType,
          registrationNumber: data.registrationNumber,
          tinNumber: data.tinNumber,
          legalStatus: data.legalStatus,
          yearEstablished: data.yearEstablished
            ? parseInt(data.yearEstablished)
            : null,
          businessSector: data.businessSector,
          numberOfEmployees: data.numberOfEmployees
            ? parseInt(data.numberOfEmployees)
            : null,
          majorObjective: data.majorObjective,
          majorActivities: data.majorActivities,
          founderNames: data.founderNames,

          // Location
          plotNumber: data.plotNumber,
          street: data.street,
          village: data.village,
          parish: data.parish,
          subCounty: data.subCounty,
          constituency: data.constituency,
          town: data.town,
          district: data.district,
          postalAddress: data.postalAddress,

          // Contact
          primaryContactPerson: data.primaryContactPerson,
          primaryContactTitle: data.primaryContactTitle,
          primaryContactPhone: data.primaryContactPhone,
          primaryContactEmail: data.primaryContactEmail,
          institutionPhone: data.institutionPhone,
          institutionEmail: data.institutionEmail,

          // Account Details
          accountTitle: data.accountTitle || data.institutionName,
          accountType: data.accountType,
          operatingInstructions: data.operatingInstructions,
          signatoryChangeRules: data.signatoryChangeRules,

          // Banking
          bankName: data.bankName,
          bankAccountNumber: data.bankAccountNumber,

          // Financial
          entryFee: data.entryFee ? parseFloat(data.entryFee) : 30000,
          initialDeposit: data.initialDeposit
            ? parseFloat(data.initialDeposit)
            : 20000,

          // Administrators (stored as JSON)
          administrators: administrators.filter(
            (admin: any) => admin.name && admin.post
          ),
          additionalDocs: [],
        },
      });

      const validAdmins = administrators.filter(
        (admin: any) => admin.name && admin.post
      );

      if (validAdmins.length > 0) {
        for (const admin of validAdmins) {
          await (tx as any).institutionSignatory.create({
            data: {
              institutionId: institution.id,
              name: admin.name,
              title: admin.post,
              phone: admin.phone || null,
              email: admin.email || null,
              signatureImage: admin.photo || admin.signature || null,
              isPrimary: false,
            },
          });
        }
      }

      // ---------------------------------------------------------
      // AUTOMATED ACCOUNT CREATION & INITIAL DEPOSIT
      // ---------------------------------------------------------

      // 1. Determine Account Type
      let accountTypeToUse = null;
      if (data.accountType) {
        // Try strict or fuzzy match
        accountTypeToUse = await tx.accountType.findFirst({
           where: { 
             OR: [
               { name: { equals: data.accountType, mode: "insensitive" } },
               { name: { contains: data.accountType, mode: "insensitive" } }
             ]
           }
        });
      }

      // Fallback
      if (!accountTypeToUse) {
         accountTypeToUse = await tx.accountType.findFirst({
             where: { name: "Savings Account" } // Default fallback
         });
      }

      // If we found a valid account type, create the account
      if (accountTypeToUse) {
          const initialDepositAmount = data.initialDeposit ? parseFloat(data.initialDeposit) : 0;
          
          // Generate a dedicated account number for the institution.
          // Format: IA-<InstitutionNumber> (e.g., IA-INST000001)
          const newAccountNumber = `IA-${institutionNumber}`;

          const newAccount = await tx.account.create({
              data: {
                  accountNumber: newAccountNumber,
                  institutionId: institution.id,
                  accountTypeId: accountTypeToUse.id,
                  balance: initialDepositAmount,
                  status: AccountStatus.ACTIVE, 
                  branchId: data.branchId,
                  openedAt: new Date(),
                  isAutoGenerated: true,
              }
          });

          // 2. Create Transaction for Initial Deposit (if > 0)
          if (initialDepositAmount > 0) {
              const transactionRef = `TXN-INST-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

              const transaction = await tx.transaction.create({
                  data: {
                      transactionRef,
                      institutionId: institution.id,
                      accountId: newAccount.id,
                      type: TransactionType.DEPOSIT,
                      amount: initialDepositAmount,
                      status: TransactionStatus.COMPLETED,
                      description: "Initial Deposit at Registration",
                      transactionDate: new Date(),
                      processedByUserId: currentUser.id,
                      branchId: data.branchId,
                  }
              });

              // 3. Create Deposit Record
              await tx.deposit.create({
                  data: {
                      transactionId: transaction.id,
                      accountId: newAccount.id,
                      amount: initialDepositAmount,
                      depositDate: new Date(),
                      handlerUserId: currentUser.id,
                      channel: "CASH", 
                      institutionId: institution.id,
                      depositType: DepositType.DIRECT,
                  }
              });
          }
      }

      // Create audit log
      await tx.auditLog.create({
        data: {
          userId: currentUser.id,
          action: "INSTITUTION_CREATED",
          entityType: "Institution",
          entityId: institution.id,
          newValue: {
            institutionNumber: institution.institutionNumber,
            institutionName: institution.institutionName,
            institutionType: institution.institutionType,
          },
          details: `Created institution: ${institution.institutionName}`,
        },
      });

      return { user, institution };
    });

    // Revalidate paths
    revalidatePath("/dashboard/users/institutions");
    revalidatePath("/dashboard");

    return {
      error: null,
      data: result,
    };
  } catch (error) {
    console.error("Error creating institution:", error);
    return {
      error: "Failed to register institution. Please try again.",
      data: null,
    };
  }
}

// Add this function to your actions/institutions.ts file

// export async function approveInstitution(institutionId: string) {
//   try {
//     const currentUser = await getAuthUser();

//     if (!currentUser) {
//       return {
//         error: "Unauthorized. Please login.",
//         data: null,
//       };
//     }

//     // Check permissions
//     const allowedRoles: UserRole[] = [UserRole.ADMIN, UserRole.BRANCHMANAGER];
//     if (!allowedRoles.includes(currentUser.role as UserRole)) {
//       return {
//         error: "You don't have permission to approve institutions",
//         data: null,
//       };
//     }

//     const institution = await db.institution.update({
//       where: { id: institutionId },
//       data: {
//         isApproved: true,
//         approvalDate: new Date(),
//       },
//       include: {
//         user: true,
//       },
//     });

//     // Create audit log
//     await db.auditLog.create({
//       data: {
//         userId: currentUser.id,
//         action: "INSTITUTION_APPROVED",
//         entityType: "Institution",
//         entityId: institutionId,
//         details: `Approved institution: ${institution.institutionName}`,
//       },
//     });

//     revalidatePath("/dashboard/users/institutions");
//     revalidatePath(`/dashboard/institutions/${institutionId}`);

//     return {
//       error: null,
//       data: institution,
//     };
//   } catch (error) {
//     console.error("Error approving institution:", error);
//     return {
//       error: "Failed to approve institution",
//       data: null,
//     };
//   }
// }

// ==============================================
// DASHBOARD FUNCTIONS - NEW
// ==============================================

/**
 * Get all transactions for an institution
 */
export async function getInstitutionTransactions(userId: string) {
  try {
    const currentUser = await getAuthUser();

    if (!currentUser || currentUser.role !== UserRole.INSTITUTION) {
      return {
        error: "Unauthorized access",
        data: [],
      };
    }

    // Verify the user is requesting their own data
    if (currentUser.id !== userId) {
      return {
        error: "You can only view your own transactions",
        data: [],
      };
    }

    // Get the institution associated with this user
    const institution = await db.institution.findUnique({
      where: { userId },
      include: {
        accounts: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!institution) {
      return {
        error: "Institution not found",
        data: [],
      };
    }

    // Get all account IDs for this institution
    const accountIds = institution.accounts.map((acc) => acc.id);

    // Fetch transactions for these accounts
    const transactions = await db.transaction.findMany({
      where: {
        OR: [
          { accountId: { in: accountIds } },
          { institutionId: institution.id },
        ],
      },
      include: {
        member: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                image: true,
              },
            },
          },
        },
        account: {
          include: {
            accountType: {
              select: {
                id: true,
                name: true,
                interestRate: true,
              },
            },
            branch: {
              select: {
                id: true,
                name: true,
                location: true,
              },
            },
          },
        },
        processedByUser: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
      orderBy: {
        transactionDate: "desc",
      },
      take: 200, // Limit to recent 200 transactions
    });

    return {
      error: null,
      data: transactions,
    };
  } catch (error) {
    console.error("Error fetching institution transactions:", error);
    return {
      error: "Failed to fetch transactions",
      data: [],
    };
  }
}

/**
 * Get comprehensive statistics for an institution
 */
export async function getInstitutionStatistics(userId: string) {
  try {
    const currentUser = await getAuthUser();

    if (!currentUser || currentUser.role !== UserRole.INSTITUTION) {
      return {
        error: "Unauthorized access",
        data: null,
      };
    }

    // Verify the user is requesting their own data
    if (currentUser.id !== userId) {
      return {
        error: "You can only view your own statistics",
        data: null,
      };
    }

    // Get the institution with accounts
    const institution = await db.institution.findUnique({
      where: { userId },
      include: {
        accounts: {
          where: {
            status: "ACTIVE",
          },
          include: {
            accountType: true,
          },
        },
      },
    });

    if (!institution) {
      return {
        error: "Institution not found",
        data: null,
      };
    }

    const accountIds = institution.accounts.map((acc) => acc.id);

    // Get all completed transactions
    const allTransactions = await db.transaction.findMany({
      where: {
        OR: [
          { accountId: { in: accountIds } },
          { institutionId: institution.id },
        ],
        status: "COMPLETED",
      },
      select: {
        id: true,
        type: true,
        amount: true,
        transactionDate: true,
        memberId: true,
      },
    });

    // Calculate statistics
    const totalTransactions = allTransactions.length;

    // Calculate deposits
    const depositTypes = ["DEPOSIT", "LOAN_REPAYMENT", "FLOAT_ALLOCATION"];
    const totalDeposits = allTransactions
      .filter((t) => depositTypes.includes(t.type))
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    // Calculate withdrawals
    const withdrawalTypes = ["WITHDRAWAL", "LOAN_DISBURSEMENT"];
    const totalWithdrawals = allTransactions
      .filter((t) => withdrawalTypes.includes(t.type))
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    // Calculate total account balance (sum of all institution account balances)
    const accountBalance = institution.accounts.reduce(
      (sum, acc) => sum + acc.balance,
      0
    );

    // Today's transactions
    const today = new Date();
    const todayStart = startOfDay(today);
    const todayEnd = endOfDay(today);

    const todayTransactions = allTransactions.filter((t) => {
      const txDate = new Date(t.transactionDate);
      return txDate >= todayStart && txDate <= todayEnd;
    });

    const todayAmount = todayTransactions.reduce(
      (sum, t) => sum + Math.abs(t.amount),
      0
    );

    // Active accounts count
    const activeAccounts = institution.accounts.length;

    // Type breakdown with proper aggregation
    const typeMap = new Map<string, { count: number; amount: number }>();

    allTransactions.forEach((t) => {
      const existing = typeMap.get(t.type) || { count: 0, amount: 0 };
      typeMap.set(t.type, {
        count: existing.count + 1,
        amount: existing.amount + Math.abs(t.amount),
      });
    });

    const typeBreakdown = Array.from(typeMap.entries()).map(([type, data]) => ({
      type,
      count: data.count,
      amount: data.amount,
    }));

    // Get unique member count
    const uniqueMemberIds = new Set(allTransactions.map((t) => t.memberId));
    const totalMembers = uniqueMemberIds.size;

    return {
      error: null,
      data: {
        totalTransactions,
        totalDeposits,
        totalWithdrawals,
        accountBalance,
        todayTransactions: todayTransactions.length,
        todayAmount,
        activeAccounts,
        totalMembers,
        typeBreakdown,
      },
    };
  } catch (error) {
    console.error("Error fetching institution statistics:", error);
    return {
      error: "Failed to fetch statistics",
      data: {
        totalTransactions: 0,
        totalDeposits: 0,
        totalWithdrawals: 0,
        accountBalance: 0,
        todayTransactions: 0,
        todayAmount: 0,
        activeAccounts: 0,
        totalMembers: 0,
        typeBreakdown: [],
      },
    };
  }
}

/**
 * Get detailed institution profile
 */
export async function getInstitutionDetails(userId: string) {
  try {
    const currentUser = await getAuthUser();

    if (!currentUser || currentUser.role !== UserRole.INSTITUTION) {
      return {
        error: "Unauthorized access",
        data: null,
      };
    }

    // Verify the user is requesting their own data
    if (currentUser.id !== userId) {
      return {
        error: "You can only view your own details",
        data: null,
      };
    }

    const institution = await db.institution.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            isActive: true,
            createdAt: true,
            branch: {
              select: {
                id: true,
                name: true,
                location: true,
                contactPerson: true,
                contactPhone: true,
              },
            },
          },
        },
        accounts: {
          include: {
            accountType: {
              select: {
                id: true,
                name: true,
                interestRate: true,
                minBalance: true,
              },
            },
            branch: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            openedAt: "desc",
          },
        },
      },
    });

    if (!institution) {
      return {
        error: "Institution not found",
        data: null,
      };
    }

    return {
      error: null,
      data: institution,
    };
  } catch (error) {
    console.error("Error fetching institution details:", error);
    return {
      error: "Failed to fetch institution details",
      data: null,
    };
  }
}

/**
 * Get institution transaction summary by date range
 */
export async function getInstitutionTransactionSummary(
  userId: string,
  startDate: Date,
  endDate: Date
) {
  try {
    const currentUser = await getAuthUser();

    if (!currentUser || currentUser.role !== UserRole.INSTITUTION) {
      return {
        error: "Unauthorized access",
        data: null,
      };
    }

    if (currentUser.id !== userId) {
      return {
        error: "You can only view your own data",
        data: null,
      };
    }

    const institution = await db.institution.findUnique({
      where: { userId },
      include: {
        accounts: {
          select: { id: true },
        },
      },
    });

    if (!institution) {
      return {
        error: "Institution not found",
        data: null,
      };
    }

    const accountIds = institution.accounts.map((acc) => acc.id);

    const transactions = await db.transaction.findMany({
      where: {
        OR: [
          { accountId: { in: accountIds } },
          { institutionId: institution.id },
        ],
        status: "COMPLETED",
        transactionDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        type: true,
        amount: true,
        transactionDate: true,
      },
    });

    // Group by type
    const summary = transactions.reduce(
      (acc, t) => {
        acc.totalAmount += Math.abs(t.amount);
        acc.totalCount += 1;

        if (!acc.byType[t.type]) {
          acc.byType[t.type] = { count: 0, amount: 0 };
        }
        acc.byType[t.type].count += 1;
        acc.byType[t.type].amount += Math.abs(t.amount);

        return acc;
      },
      {
        totalCount: 0,
        totalAmount: 0,
        byType: {} as Record<string, { count: number; amount: number }>,
      }
    );

    return {
      error: null,
      data: summary,
    };
  } catch (error) {
    console.error("Error fetching transaction summary:", error);
    return {
      error: "Failed to fetch transaction summary",
      data: null,
    };
  }
}
// ============================================
// FILE 1: actions/institutions.ts
// Updated getAllInstitutions with branch filtering
// ============================================

// GET ALL INSTITUTIONS - FILTERED BY BRANCH
export async function getAllInstitutions() {
  try {
    const currentUser = await getAuthUser();

    if (!currentUser) {
      return {
        error: "Unauthorized. Please login.",
        data: [],
      };
    }

    // Build where clause based on role
    let whereClause: any = {};

    if (currentUser.role === UserRole.ADMIN) {
      // ADMIN sees all institutions
      whereClause = {};
    } else {
      // Non-ADMIN users only see institutions in their branch
      if (!currentUser.branchId) {
        return {
          error: "You are not assigned to any branch. Contact administrator.",
          data: [],
        };
      }

      whereClause = {
        user: {
          branchId: currentUser.branchId,
        },
      };
    }

    const institutions = await db.institution.findMany({
      where: whereClause,
      orderBy: {
        createdAt: "desc",
      },
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
            branch: {
              select: {
                name: true,
              },
            },
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
      },
    });

    return {
      error: null,
      data: institutions,
    };
  } catch (error) {
    console.error("Error fetching institutions:", error);
    return {
      error: "Failed to fetch institutions",
      data: [],
    };
  }
}

// GET INSTITUTION BY ID - WITH BRANCH CHECK
export async function getInstitutionById(institutionId: string) {
  try {
    const currentUser = await getAuthUser();

    if (!currentUser) {
      return {
        error: "Unauthorized. Please login.",
        data: null,
      };
    }

    const institution = await db.institution.findUnique({
      where: { id: institutionId },
      include: {
        user: {
          include: {
            branch: true,
          },
        },
        accounts: {
          include: {
            accountType: true,
          },
        },
      },
    });

    if (!institution) {
      return {
        error: "Institution not found",
        data: null,
      };
    }

    // Check if user has permission to view this institution
    if (currentUser.role !== UserRole.ADMIN) {
      if (institution.user.branchId !== currentUser.branchId) {
        return {
          error: "You don't have permission to view this institution",
          data: null,
        };
      }
    }

    return {
      error: null,
      data: institution,
    };
  } catch (error) {
    console.error("Error fetching institution:", error);
    return {
      error: "Failed to fetch institution data",
      data: null,
    };
  }
}

// CREATE INSTITUTION - FORCE BRANCH ASSIGNMENT
// export async function createInstitution(data: any) {
//   try {
//     const currentUser = await getAuthUser();

//     if (!currentUser) {
//       return {
//         error: "Unauthorized. Please login.",
//         data: null,
//       };
//     }

//     // Check permissions
//     const allowedRoles: UserRole[] = [
//       UserRole.ADMIN,
//       UserRole.BRANCHMANAGER,
//       UserRole.TELLER,
//     ];
//     if (!allowedRoles.includes(currentUser.role as UserRole)) {
//       return {
//         error: "You don't have permission to register institutions",
//         data: null,
//       };
//     }

//     // Validate required fields
//     if (!data.institutionName || !data.institutionType) {
//       return {
//         error: "Institution name and type are required",
//         data: null,
//       };
//     }

//     if (!data.institutionEmail || !data.institutionPhone) {
//       return {
//         error: "Institution email and phone are required",
//         data: null,
//       };
//     }

//     if (!data.primaryContactPerson || !data.primaryContactPhone) {
//       return {
//         error: "Primary contact person and phone are required",
//         data: null,
//       };
//     }

//     // CRITICAL: Force branchId to current user's branch (unless ADMIN)
//     let finalBranchId: string;

//     if (currentUser.role === UserRole.ADMIN) {
//       // ADMIN can choose any branch
//       finalBranchId = data.branchId;
//     } else {
//       // Non-ADMIN: Force to their own branch
//       if (!currentUser.branchId) {
//         return {
//           error: "You are not assigned to any branch. Contact administrator.",
//           data: null,
//         };
//       }
//       finalBranchId = currentUser.branchId;
//     }

//     if (!finalBranchId) {
//       return {
//         error: "Branch selection is required",
//         data: null,
//       };
//     }

//     // Check if email already exists
//     const existingEmail = await db.user.findUnique({
//       where: { email: data.institutionEmail },
//     });

//     if (existingEmail) {
//       return {
//         error: "Email address is already registered",
//         data: null,
//       };
//     }

//     // Check if phone already exists
//     if (data.institutionPhone) {
//       const existingPhone = await db.user.findUnique({
//         where: { phone: data.institutionPhone },
//       });

//       if (existingPhone) {
//         return {
//           error: "Phone number is already registered",
//           data: null,
//         };
//       }
//     }

//     // Hash password
//     const hashedPassword = await bcrypt.hash(data.password, 10);

//     // Generate institution number
//     const institutionCount = await db.institution.count();
//     const institutionNumber = `INST${String(institutionCount + 1).padStart(6, "0")}`;

//     // Create user and institution in a transaction
//     const result = await db.$transaction(async (tx) => {
//       // Create User with FORCED branchId
//       const user = await tx.user.create({
//         data: {
//           firstName: data.institutionName,
//           lastName: data.institutionType,
//           name: data.institutionName,
//           email: data.institutionEmail,
//           phone: data.institutionPhone,
//           password: hashedPassword,
//           role: UserRole.INSTITUTION,
//           branchId: finalBranchId, // FORCED branch
//           isActive: true,
//           isVerified: false,
//         },
//       });

//       // Create Institution
//       const institution = await tx.institution.create({
//         data: {
//           userId: user.id,
//           institutionNumber,
//           isApproved: false,

//           // Basic Information
//           institutionName: data.institutionName,
//           institutionType: data.institutionType,
//           registrationNumber: data.registrationNumber,
//           tinNumber: data.tinNumber,
//           legalStatus: data.legalStatus,
//           yearEstablished: data.yearEstablished
//             ? parseInt(data.yearEstablished)
//             : null,
//           businessSector: data.businessSector,
//           numberOfEmployees: data.numberOfEmployees
//             ? parseInt(data.numberOfEmployees)
//             : null,
//           majorObjective: data.majorObjective,
//           majorActivities: data.majorActivities,
//           founderNames: data.founderNames,

//           // Location
//           plotNumber: data.plotNumber,
//           street: data.street,
//           village: data.village,
//           parish: data.parish,
//           subCounty: data.subCounty,
//           constituency: data.constituency,
//           town: data.town,
//           district: data.district,
//           postalAddress: data.postalAddress,

//           // Contact
//           primaryContactPerson: data.primaryContactPerson,
//           primaryContactTitle: data.primaryContactTitle,
//           primaryContactPhone: data.primaryContactPhone,
//           primaryContactEmail: data.primaryContactEmail,
//           institutionPhone: data.institutionPhone,
//           institutionEmail: data.institutionEmail,

//           // Account Details
//           accountTitle: data.accountTitle || data.institutionName,
//           accountType: data.accountType,
//           operatingInstructions: data.operatingInstructions,
//           signatoryChangeRules: data.signatoryChangeRules,

//           // Banking
//           bankName: data.bankName,
//           bankAccountNumber: data.bankAccountNumber,

//           // Financial
//           entryFee: data.entryFee ? parseFloat(data.entryFee) : 30000,
//           initialDeposit: data.initialDeposit
//             ? parseFloat(data.initialDeposit)
//             : 20000,

//           // Administrators (stored as JSON)
//           administrators:
//             data.administrators?.filter(
//               (admin: any) => admin.name && admin.post
//             ) || [],
//         },
//       });

//       // Create audit log
//       await tx.auditLog.create({
//         data: {
//           userId: currentUser.id,
//           action: "INSTITUTION_CREATED",
//           entityType: "Institution",
//           entityId: institution.id,
//           newValue: {
//             institutionNumber: institution.institutionNumber,
//             institutionName: institution.institutionName,
//             institutionType: institution.institutionType,
//             branchId: finalBranchId,
//             createdBy: currentUser.name,
//             createdByRole: currentUser.role,
//           },
//           details: `Created institution: ${institution.institutionName} in branch: ${finalBranchId}`,
//         },
//       });

//       return { user, institution };
//     });

//     // Revalidate paths
//     revalidatePath("/dashboard/users/institutions");
//     revalidatePath("/dashboard");

//     return {
//       error: null,
//       data: result,
//     };
//   } catch (error) {
//     console.error("Error creating institution:", error);
//     return {
//       error: "Failed to register institution. Please try again.",
//       data: null,
//     };
//   }
// }

// UPDATE INSTITUTION - WITH BRANCH CHECK
export async function updateInstitution(institutionId: string, data: any) {
  try {
    const currentUser = await getAuthUser();

    if (!currentUser) {
      return { error: "Unauthorized. Please login." };
    }

    // Check permissions
    const allowedRoles: UserRole[] = [
      UserRole.ADMIN,
      UserRole.BRANCHMANAGER,
      UserRole.ACCOUNTANT,
      UserRole.DATA_ENTRANT,
    ];
    if (!allowedRoles.includes(currentUser.role as UserRole)) {
      return { error: "You don't have permission to update institutions" };
    }

    // Verify institution exists
    const existingInstitution = await db.institution.findUnique({
      where: { id: institutionId },
      include: { user: true },
    });

    if (!existingInstitution) {
      return { error: "Institution not found" };
    }

    // Branch check for non-ADMIN users
    if (currentUser.role !== UserRole.ADMIN) {
      if (existingInstitution.user.branchId !== currentUser.branchId) {
        return {
          error: "You can only update institutions in your branch",
        };
      }
    }

    // Determine final branchId (prevent branch change for non-ADMIN)
    let finalBranchId: string;

    if (currentUser.role === UserRole.ADMIN) {
      finalBranchId = data.branchId;
    } else {
      // Non-ADMIN cannot change branch
      finalBranchId = existingInstitution.user.branchId!;
    }

    // Check if email is being changed and if it's already in use
    if (data.institutionEmail !== existingInstitution.institutionEmail) {
      const emailExists = await db.user.findUnique({
        where: { email: data.institutionEmail },
      });

      if (emailExists && emailExists.id !== existingInstitution.userId) {
        return { error: "Email already in use" };
      }
    }

    // Update institution and user in a transaction
    const updated = await db.$transaction(async (tx) => {
      const administrators = Array.isArray(data.administrators)
        ? data.administrators
        : [];

      // Update user email and branch
      await tx.user.update({
        where: { id: existingInstitution.userId },
        data: {
          email: data.institutionEmail,
          branchId: finalBranchId,
        },
      });

      // Update institution
      return await tx.institution.update({
        where: { id: institutionId },
        data: {
          institutionName: data.institutionName,
          institutionType: data.institutionType,
          registrationDate: new Date(data.registrationDate),
          registrationNumber: data.registrationNumber || null,
          tinNumber: data.tinNumber || null,
          yearEstablished: data.yearEstablished || null,
          legalStatus: data.legalStatus || null,
          businessSector: data.businessSector || null,
          numberOfEmployees: data.numberOfEmployees || null,
          primaryContactPerson: data.primaryContactPerson,
          primaryContactTitle: data.primaryContactTitle || null,
          primaryContactPhone: data.primaryContactPhone,
          primaryContactEmail: data.primaryContactEmail || null,
          institutionPhone: data.institutionPhone,
          institutionEmail: data.institutionEmail,
          plotNumber: data.plotNumber || null,
          street: data.street || null,
          village: data.village || null,
          parish: data.parish || null,
          subCounty: data.subCounty || null,
          constituency: data.constituency || null,
          town: data.town || null,
          district: data.district || null,
          postalAddress: data.postalAddress || null,
          bankName: data.bankName || null,
          bankAccountNumber: data.bankAccountNumber || null,
          accountTitle: data.accountTitle || null,
          accountType: data.accountType || null,
          entryFee: data.entryFee || null,
          initialDeposit: data.initialDeposit || null,
          majorObjective: data.majorObjective || null,
          majorActivities: data.majorActivities || null,
          founderNames: data.founderNames || null,
          operatingInstructions: data.operatingInstructions || null,
          signatoryChangeRules: data.signatoryChangeRules || null,
          administrators,
        },
        include: {
          user: {
            include: {
              branch: true,
            },
          },
        },
      });

      await tx.institutionSignatory.deleteMany({
        where: { institutionId },
      });

      const validAdmins = administrators.filter(
        (admin: any) => admin?.name && admin?.post,
      );

      for (const admin of validAdmins) {
        await (tx as any).institutionSignatory.create({
          data: {
            institutionId,
            name: admin.name,
            title: admin.post,
            phone: admin.phone || null,
            email: admin.email || null,
            signatureImage: admin.photo || admin.signature || null,
            isPrimary: false,
          },
        });
      }
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: currentUser.id,
        action: "INSTITUTION_UPDATED",
        entityType: "Institution",
        entityId: institutionId,
        details: `Updated institution: ${data.institutionName}`,
      },
    });

    revalidatePath("/dashboard/users/institutions");
    revalidatePath(`/dashboard/institutions/${institutionId}`);

    return { data: updated };
  } catch (error) {
    console.error("Error updating institution:", error);
    return { error: "Failed to update institution" };
  }
}

// APPROVE INSTITUTION - WITH BRANCH CHECK
export async function approveInstitution(institutionId: string) {
  try {
    const currentUser = await getAuthUser();

    if (!currentUser) {
      return {
        error: "Unauthorized. Please login.",
        data: null,
      };
    }

    // Check permissions
    const allowedRoles: UserRole[] = [UserRole.ADMIN, UserRole.BRANCHMANAGER];
    if (!allowedRoles.includes(currentUser.role as UserRole)) {
      return {
        error: "You don't have permission to approve institutions",
        data: null,
      };
    }

    // Get institution with user data
    const existingInstitution = await db.institution.findUnique({
      where: { id: institutionId },
      include: { user: true },
    });

    if (!existingInstitution) {
      return {
        error: "Institution not found",
        data: null,
      };
    }

    // Branch check for non-ADMIN users
    if (currentUser.role !== UserRole.ADMIN) {
      if (existingInstitution.user.branchId !== currentUser.branchId) {
        return {
          error: "You can only approve institutions in your branch",
          data: null,
        };
      }
    }

    const institution = await db.institution.update({
      where: { id: institutionId },
      data: {
        isApproved: true,
        approvalDate: new Date(),
      },
      include: {
        user: true,
      },
    });

    await db.user.update({
      where: { id: existingInstitution.userId },
      data: {
        isActive: true,
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: currentUser.id,
        action: "INSTITUTION_APPROVED",
        entityType: "Institution",
        entityId: institutionId,
        details: `Approved institution: ${institution.institutionName}`,
      },
    });

    revalidatePath("/dashboard/users/institutions");
    revalidatePath(`/dashboard/institutions/${institutionId}`);

    return {
      error: null,
      data: institution,
    };
  } catch (error) {
    console.error("Error approving institution:", error);
    return {
      error: "Failed to approve institution",
      data: null,
    };
  }
}

// DELETE INSTITUTION - WITH BRANCH CHECK
export async function deleteInstitution(institutionId: string) {
  try {
    const currentUser = await getAuthUser();

    if (!currentUser) {
      return {
        error: "Unauthorized. Please login.",
        data: null,
      };
    }

    // Check permissions
    const allowedRoles: UserRole[] = [UserRole.ADMIN, UserRole.BRANCHMANAGER];
    if (!allowedRoles.includes(currentUser.role as UserRole)) {
      return {
        error: "You don't have permission to delete institutions",
        data: null,
      };
    }

    const institution = await db.institution.findUnique({
      where: { id: institutionId },
      include: { user: true },
    });

    if (!institution) {
      return {
        error: "Institution not found",
        data: null,
      };
    }

    // Branch check for non-ADMIN users
    if (currentUser.role !== UserRole.ADMIN) {
      if (institution.user.branchId !== currentUser.branchId) {
        return {
          error: "You can only delete institutions in your branch",
          data: null,
        };
      }
    }

    // Soft delete by deactivating the user
    await db.user.update({
      where: { id: institution.userId },
      data: { isActive: false },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: currentUser.id,
        action: "INSTITUTION_DELETED",
        entityType: "Institution",
        entityId: institutionId,
        details: `Deleted institution: ${institution.institutionName}`,
      },
    });

    revalidatePath("/dashboard/users/institutions");

    return {
      error: null,
      data: institution,
    };
  } catch (error) {
    console.error("Error deleting institution:", error);
    return {
      error: "Failed to delete institution",
      data: null,
    };
  }
}
