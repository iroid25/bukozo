// // actions/branches.ts
// "use server";

// import { db } from "@/prisma/db";
// import { BranchCreateDTO, BranchUpdateDTO } from "@/types/branches";
// import { revalidatePath } from "next/cache";

// // Fetch all branches
// export async function getAllBranches() {
//   try {
//     const branches = await db.branch.findMany({
//       include: {
//         _count: {
//           select: {
//             users: true,
//             accounts: true,
//             loans: true,
//             floatAllocations: true,
//           },
//         },
//       },
//       orderBy: {
//         createdAt: "desc",
//       },
//     });
//     return branches;
//   } catch (error) {
//     console.error("Error fetching branches:", error);
//     return [];
//   }
// }

// // Fetch single branch by ID
// export async function getBranchById(id: string) {
//   try {
//     const branch = await db.branch.findUnique({
//       where: { id },
//       include: {
//         _count: {
//           select: {
//             users: true,
//             accounts: true,
//             loans: true,
//             floatAllocations: true,
//           },
//         },
//       },
//     });
//     return branch;
//   } catch (error) {
//     console.error("Error fetching branch:", error);
//     return null;
//   }
// }

// // Create new branch
// export async function createBranch(data: BranchCreateDTO) {
//   try {
//     // Check if branch name already exists
//     const existingBranch = await db.branch.findUnique({
//       where: { name: data.name },
//     });

//     if (existingBranch) {
//       return {
//         error: "A branch with this name already exists",
//         data: null,
//       };
//     }

//     const branch = await db.branch.create({
//       data: {
//         name: data.name.trim(),
//         location: data.location.trim(),
//         contactPerson: data.contactPerson?.trim() || null,
//         contactPhone: data.contactPhone?.trim() || null,
//         email: data.email?.trim() || null,
//       },
//     });

//     revalidatePath("/dashboard/branches");
//     return {
//       error: null,
//       data: branch,
//     };
//   } catch (error) {
//     console.error("Error creating branch:", error);
//     return {
//       error: "Failed to create branch. Please try again.",
//       data: null,
//     };
//   }
// }

// // Update existing branch
// export async function updateBranch(data: BranchUpdateDTO) {
//   try {
//     // Check if name is being updated and if it conflicts with existing branch
//     if (data.name) {
//       const existingBranch = await db.branch.findFirst({
//         where: {
//           name: data.name,
//           NOT: { id: data.id },
//         },
//       });

//       if (existingBranch) {
//         return {
//           error: "A branch with this name already exists",
//           data: null,
//         };
//       }
//     }

//     const branch = await db.branch.update({
//       where: { id: data.id },
//       data: {
//         ...(data.name && { name: data.name.trim() }),
//         ...(data.location && { location: data.location.trim() }),
//         ...(data.contactPerson !== undefined && {
//           contactPerson: data.contactPerson?.trim() || null,
//         }),
//         ...(data.contactPhone !== undefined && {
//           contactPhone: data.contactPhone?.trim() || null,
//         }),
//         ...(data.email !== undefined && {
//           email: data.email?.trim() || null,
//         }),
//         updatedAt: new Date(),
//       },
//     });

//     revalidatePath("/dashboard/branches");
//     return {
//       error: null,
//       data: branch,
//     };
//   } catch (error) {
//     console.error("Error updating branch:", error);
//     return {
//       error: "Failed to update branch. Please try again.",
//       data: null,
//     };
//   }
// }

// // Delete branch (soft delete by checking if it has dependencies)
// export async function deleteBranch(id: string) {
//   try {
//     // Check if branch has dependencies
//     const branch = await db.branch.findUnique({
//       where: { id },
//       include: {
//         _count: {
//           select: {
//             users: true,
//             accounts: true,
//             loans: true,
//             floatAllocations: true,
//           },
//         },
//       },
//     });

//     if (!branch) {
//       return {
//         error: "Branch not found",
//         data: null,
//       };
//     }

//     // Check if branch has any dependencies
//     const totalDependencies =
//       branch._count.users +
//       branch._count.accounts +
//       branch._count.loans +
//       branch._count.floatAllocations;

//     if (totalDependencies > 0) {
//       return {
//         error:
//           "Cannot delete branch. It has associated users, accounts, loans, or float allocations.",
//         data: null,
//       };
//     }

//     await db.branch.delete({
//       where: { id },
//     });

//     revalidatePath("/dashboard/branches");
//     return {
//       error: null,
//       data: { message: "Branch deleted successfully" },
//     };
//   } catch (error) {
//     console.error("Error deleting branch:", error);
//     return {
//       error: "Failed to delete branch. Please try again.",
//       data: null,
//     };
//   }
// }
// actions/branches.ts
"use server";

import { db } from "@/prisma/db";
import { BranchCreateDTO, BranchUpdateDTO } from "@/types/branches";
import { revalidatePath } from "next/cache";
import { getAuthUser } from "@/config/useAuth";

/**
 * Get the current user's role and branch info
 */
async function getCurrentUserBranchInfo() {
  try {
    const user = await getAuthUser();
    if (!user) {
      throw new Error("User not authenticated");
    }

    return {
      userId: user.id,
      userRole: user.role,
      branchId: user.branchId,
      isAdmin: user.role === "ADMIN",
      isBranchManager: user.role === "BRANCHMANAGER",
    };
  } catch (error) {
    console.error("Error getting user info:", error);
    throw error;
  }
}

/**
 * Fetch all branches with role-based filtering
 * - Admins see all branches
 * - Branch Managers see only their branch
 * - Other roles see no branches
 */
export async function getAllBranches() {
  try {
    const userInfo = await getCurrentUserBranchInfo();

    // Build where clause based on role
    const whereClause: any = {};

    // Branch managers can only see their own branch
    if (userInfo.isBranchManager && userInfo.branchId) {
      whereClause.id = userInfo.branchId;
    } else if (!userInfo.isAdmin) {
      // Other non-admin roles see nothing
      whereClause.id = "NONE";
    }
    // Admins see everything (no filter)

    const branches = await db.branch.findMany({
      where: whereClause,
      include: {
        _count: {
          select: {
            users: true,
            accounts: true,
            loans: true,
            floatAllocations: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    return branches;
  } catch (error) {
    console.error("Error fetching branches:", error);
    return [];
  }
}

/**
 * Fetch single branch by ID with authorization check
 */
export async function getBranchById(id: string) {
  try {
    const userInfo = await getCurrentUserBranchInfo();

    // Check authorization
    if (userInfo.isBranchManager && userInfo.branchId !== id) {
      console.warn("Branch manager trying to access different branch");
      return null;
    }

    if (!userInfo.isAdmin && !userInfo.isBranchManager) {
      console.warn("Unauthorized user trying to access branch");
      return null;
    }

    const branch = await db.branch.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            accounts: true,
            loans: true,
            floatAllocations: true,
          },
        },
      },
    });
    return branch;
  } catch (error) {
    console.error("Error fetching branch:", error);
    return null;
  }
}

/**
 * Get branch statistics with filtering
 */
export async function getBranchStatistics(branchId: string) {
  try {
    const userInfo = await getCurrentUserBranchInfo();

    // Check authorization
    if (userInfo.isBranchManager && userInfo.branchId !== branchId) {
      return {
        error: "You can only view statistics for your own branch",
        data: null,
      };
    }

    if (!userInfo.isAdmin && !userInfo.isBranchManager) {
      return {
        error: "You do not have permission to view branch statistics",
        data: null,
      };
    }

    const [
      totalUsers,
      totalAccounts,
      totalLoans,
      activeLoans,
      totalFloatAllocations,
      accountsBalance,
      loansOutstanding,
    ] = await Promise.all([
      db.user.count({
        where: { branchId },
      }),
      db.account.count({
        where: { branchId },
      }),
      db.loan.count({
        where: { branchId },
      }),
      db.loan.count({
        where: {
          branchId,
          status: { in: ["DISBURSED", "OVERDUE"] },
        },
      }),
      db.floatAllocation.count({
        where: { branchId },
      }),
      db.account.aggregate({
        where: { branchId, status: "ACTIVE" },
        _sum: { balance: true },
      }),
      db.loan.aggregate({
        where: {
          branchId,
          status: { in: ["DISBURSED", "OVERDUE"] },
        },
        _sum: { outstandingBalance: true },
      }),
    ]);

    return {
      error: null,
      data: {
        totalUsers,
        totalAccounts,
        totalLoans,
        activeLoans,
        totalFloatAllocations,
        totalAccountsBalance: accountsBalance._sum.balance || 0,
        totalLoansOutstanding: loansOutstanding._sum.outstandingBalance || 0,
      },
    };
  } catch (error) {
    console.error("Error fetching branch statistics:", error);
    return {
      error: "Failed to fetch branch statistics",
      data: null,
    };
  }
}

/**
 * Get users in a specific branch
 */
export async function getBranchUsers(branchId: string) {
  try {
    const userInfo = await getCurrentUserBranchInfo();

    // Check authorization
    if (userInfo.isBranchManager && userInfo.branchId !== branchId) {
      return {
        error: "You can only view users in your own branch",
        data: null,
      };
    }

    if (!userInfo.isAdmin && !userInfo.isBranchManager) {
      return {
        error: "You do not have permission to view branch users",
        data: null,
      };
    }

    const users = await db.user.findMany({
      where: { branchId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return {
      error: null,
      data: users,
    };
  } catch (error) {
    console.error("Error fetching branch users:", error);
    return {
      error: "Failed to fetch branch users",
      data: null,
    };
  }
}

/**
 * Create new branch (Admin only)
 */
export async function createBranch(data: BranchCreateDTO) {
  try {
    const userInfo = await getCurrentUserBranchInfo();

    // Only admins can create branches
    if (!userInfo.isAdmin) {
      return {
        error: "Only administrators can create branches",
        data: null,
      };
    }

    // Check if branch name already exists
    const existingBranch = await db.branch.findUnique({
      where: { name: data.name },
    });

    if (existingBranch) {
      return {
        error: "A branch with this name already exists",
        data: null,
      };
    }

    const branch = await db.$transaction(async (tx) => {
      const newBranch = await tx.branch.create({
        data: {
          name: data.name.trim(),
          location: data.location.trim(),
          contactPerson: data.contactPerson?.trim() || null,
          contactPhone: data.contactPhone?.trim() || null,
          email: data.email?.trim() || null,
          accountantId: data.accountantId || null,
          managerId: data.managerId || null,
        },
      });

      // Initialize a default vault for the branch
      await tx.vault.create({
        data: {
          name: `Branch Reserve - ${newBranch.name}`,
          branchId: newBranch.id,
          balance: 0,
          physicalCash: 0,
          isActive: true,
          location: newBranch.location,
          custodianUserId: data.accountantId || null, // Default to assigned accountant
        },
      });

      return await tx.branch.findUnique({
        where: { id: newBranch.id },
        include: { vaults: true }
      });
    });
    
    if (!branch) {
      return {
        error: "Failed to create branch record",
        data: null,
      };
    }

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: userInfo.userId,
        action: "CREATE_BRANCH",
        entityType: "Branch",
        entityId: branch.id,
        details: `Created branch: ${branch.name} at ${branch.location}`,
        timestamp: new Date(),
      },
    });

    revalidatePath("/dashboard/branches");
    return {
      error: null,
      data: branch,
    };
  } catch (error) {
    console.error("Error creating branch:", error);
    return {
      error: "Failed to create branch. Please try again.",
      data: null,
    };
  }
}

/**
 * Update existing branch
 * - Admins can update any branch
 * - Branch Managers can only update their own branch
 */
export async function updateBranch(data: BranchUpdateDTO) {
  try {
    const userInfo = await getCurrentUserBranchInfo();

    // Check authorization
    if (userInfo.isBranchManager && userInfo.branchId !== data.id) {
      return {
        error: "You can only update your own branch",
        data: null,
      };
    }

    if (!userInfo.isAdmin && !userInfo.isBranchManager) {
      return {
        error: "You do not have permission to update branches",
        data: null,
      };
    }

    // Check if name is being updated and if it conflicts with existing branch
    if (data.name) {
      const existingBranch = await db.branch.findFirst({
        where: {
          name: data.name,
          NOT: { id: data.id },
        },
      });

      if (existingBranch) {
        return {
          error: "A branch with this name already exists",
          data: null,
        };
      }
    }

    // Get old data for audit log
    const oldBranch = await db.branch.findUnique({
      where: { id: data.id },
    });

    const branch = await db.branch.update({
      where: { id: data.id },
      data: {
        ...(data.name && { name: data.name.trim() }),
        ...(data.location && { location: data.location.trim() }),
        ...(data.contactPerson !== undefined && {
          contactPerson: data.contactPerson?.trim() || null,
        }),
        ...(data.contactPhone !== undefined && {
          contactPhone: data.contactPhone?.trim() || null,
        }),
        ...(data.email !== undefined && {
          email: data.email?.trim() || null,
        }),
        ...(data.accountantId !== undefined && {
          accountantId: data.accountantId || null,
        }),
        ...(data.managerId !== undefined && {
          managerId: data.managerId || null,
        }),
        updatedAt: new Date(),
      },
    });

    // Create audit log with properly serialized JSON values
    await db.auditLog.create({
      data: {
        userId: userInfo.userId,
        action: "UPDATE_BRANCH",
        entityType: "Branch",
        entityId: branch.id,
        oldValue: oldBranch ? JSON.parse(JSON.stringify(oldBranch)) : null,
        newValue: JSON.parse(JSON.stringify(branch)),
        details: `Updated branch: ${branch.name}`,
        timestamp: new Date(),
      },
    });

    revalidatePath("/dashboard/branches");
    return {
      error: null,
      data: branch,
    };
  } catch (error) {
    console.error("Error updating branch:", error);
    return {
      error: "Failed to update branch. Please try again.",
      data: null,
    };
  }
}

/**
 * Delete branch (Admin only)
 */
export async function deleteBranch(id: string) {
  try {
    const userInfo = await getCurrentUserBranchInfo();

    // Only admins can delete branches
    if (!userInfo.isAdmin) {
      return {
        error: "Only administrators can delete branches",
        data: null,
      };
    }

    // Check if branch has dependencies
    const branch = await db.branch.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            accounts: true,
            loans: true,
            floatAllocations: true,
          },
        },
      },
    });

    if (!branch) {
      return {
        error: "Branch not found",
        data: null,
      };
    }

    // Check if branch has any dependencies
    const totalDependencies =
      branch._count.users +
      branch._count.accounts +
      branch._count.loans +
      branch._count.floatAllocations;

    if (totalDependencies > 0) {
      return {
        error:
          "Cannot delete branch. It has associated users, accounts, loans, or float allocations.",
        data: null,
      };
    }

    await db.branch.delete({
      where: { id },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: userInfo.userId,
        action: "DELETE_BRANCH",
        entityType: "Branch",
        entityId: id,
        details: `Deleted branch: ${branch.name}`,
        timestamp: new Date(),
      },
    });

    revalidatePath("/dashboard/branches");
    return {
      error: null,
      data: { message: "Branch deleted successfully" },
    };
  } catch (error) {
    console.error("Error deleting branch:", error);
    return {
      error: "Failed to delete branch. Please try again.",
      data: null,
    };
  }
}

/**
 * Check if user can access a specific branch
 */
export async function canUserAccessBranch(branchId: string): Promise<boolean> {
  try {
    const userInfo = await getCurrentUserBranchInfo();

    // Admins can access all branches
    if (userInfo.isAdmin) {
      return true;
    }

    // Branch managers can only access their own branch
    if (userInfo.isBranchManager && userInfo.branchId === branchId) {
      return true;
    }

    return false;
  } catch (error) {
    console.error("Error checking branch access:", error);
    return false;
  }
}

/**
 * Get all branches (for dropdowns/selects) - No filtering
 * Used when admins need to assign branches to users
 */
export async function getAllBranchesForSelection() {
  try {
    const userInfo = await getCurrentUserBranchInfo();

    // Only admins can see all branches for selection
    if (!userInfo.isAdmin) {
      return {
        error: "Only administrators can access all branches",
        data: [],
      };
    }

    const branches = await db.branch.findMany({
      select: {
        id: true,
        name: true,
        location: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return {
      error: null,
      data: branches,
    };
  } catch (error) {
    console.error("Error fetching branches for selection:", error);
    return {
      error: "Failed to fetch branches",
      data: [],
    };
  }
}

/**
 * Get current user's branch details
 * Useful for branch managers to see their own branch info
 */
export async function getMyBranch() {
  try {
    const userInfo = await getCurrentUserBranchInfo();

    if (!userInfo.branchId) {
      return {
        error: "You are not assigned to any branch",
        data: null,
      };
    }

    const branch = await db.branch.findUnique({
      where: { id: userInfo.branchId },
      include: {
        _count: {
          select: {
            users: true,
            accounts: true,
            loans: true,
            floatAllocations: true,
          },
        },
      },
    });

    if (!branch) {
      return {
        error: "Branch not found",
        data: null,
      };
    }

    return {
      error: null,
      data: branch,
    };
  } catch (error) {
    console.error("Error fetching user's branch:", error);
    return {
      error: "Failed to fetch branch details",
      data: null,
    };
  }
}
