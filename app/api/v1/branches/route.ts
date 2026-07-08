// @ts-nocheck
// import { NextRequest, NextResponse } from "next/server";
// import { db } from "@/prisma/db";
// import { getServerSession } from "next-auth";
// import { authOptions } from "@/config/auth";

// // GET /api/v1/branches - Fetch all branches
// export async function GET(request: NextRequest) {
//   try {
//     const session = await getServerSession(authOptions);

//     if (!session?.user) {
//       return NextResponse.json(
//         { error: "Unauthorized" },
//         { status: 401 }
//       );
//     }

//     const branches = await db.branch.findMany({
//       include: {
//         _count: {
//           select: {
//             users: true,
//             accounts: true,
//             loans: true,
//           },
//         },
//       },
//       orderBy: {
//         name: "asc",
//       },
//     });

//     return NextResponse.json({
//       data: branches,
//     });
//   } catch (error) {
//     console.error("Error fetching branches:", error);
//     return NextResponse.json(
//       { error: "Failed to fetch branches" },
//       { status: 500 }
//     );
//   }
// }

// // POST /api/v1/branches - Create a new branch
// export async function POST(request: NextRequest) {
//   try {
//     const session = await getServerSession(authOptions);

//     if (!session?.user) {
//       return NextResponse.json(
//         { error: "Unauthorized" },
//         { status: 401 }
//       );
//     }

//     const userRole = (session.user as any).role;
//     if (!["ADMIN"].includes(userRole)) {
//       return NextResponse.json(
//         { error: "Only admins can create branches" },
//         { status: 403 }
//       );
//     }

//     const body = await request.json();

//     // Validate required fields
//     if (!body.name || !body.location) {
//       return NextResponse.json(
//         { error: "Name and location are required" },
//         { status: 400 }
//       );
//     }

//     // Check if branch name already exists
//     const existing = await db.branch.findUnique({
//       where: { name: body.name },
//     });

//     if (existing) {
//       return NextResponse.json(
//         { error: "Branch with this name already exists" },
//         { status: 409 }
//       );
//     }

//     // Create branch
//     const branch = await db.branch.create({
//       data: {
//         name: body.name,
//         location: body.location,
//         contactPerson: body.contactPerson || null,
//         contactPhone: body.contactPhone || null,
//         email: body.email || null,
//       },
//     });

//     return NextResponse.json(
//       {
//         data: branch,
//         message: "Branch created successfully"
//       },
//       { status: 201 }
//     );
//   } catch (error) {
//     console.error("Error creating branch:", error);
//     return NextResponse.json(
//       { error: "Failed to create branch" },
//       { status: 500 }
//     );
//   }
// }

// app/api/v1/branches/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { UserRole } from "@prisma/client";

// GET /api/v1/branches - Fetch all branches
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = (session.user as any).role as UserRole;
    const sessionBranchId = (session.user as any).branchId as string | undefined;

    const branches = await db.branch.findMany({
      where:
        role === UserRole.ADMIN
          ? undefined
          : sessionBranchId
            ? { id: sessionBranchId }
            : { id: "no-branch" },
      include: {
        _count: {
          select: {
            users: true,
            accounts: true,
            loans: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json({
      data: branches,
    });
  } catch (error) {
    console.error("Error fetching branches:", error);
    return NextResponse.json(
      { error: "Failed to fetch branches" },
      { status: 500 }
    );
  }
}

// POST /api/v1/branches - Create a new branch
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    if (!["ADMIN"].includes(userRole)) {
      return NextResponse.json(
        { error: "Only admins can create branches" },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate required fields
    if (!body.name || !body.location) {
      return NextResponse.json(
        { error: "Name and location are required" },
        { status: 400 }
      );
    }

    // Check if branch name already exists
    const existing = await db.branch.findUnique({
      where: { name: body.name.trim() },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Branch with this name already exists" },
        { status: 409 }
      );
    }

    // Create branch and vault in transaction
    const branch = await db.$transaction(async (tx) => {
      const newBranch = await tx.branch.create({
        data: {
          name: body.name.trim(),
          location: body.location.trim(),
          contactPerson: body.contactPerson?.trim() || null,
          contactPhone: body.contactPhone?.trim() || null,
          email: body.email?.trim() || null,
          accountantId: body.accountantId || null,
          managerId: body.managerId || null,
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
          custodianUserId: body.accountantId || null,
        },
      });

      return await tx.branch.findUnique({
        where: { id: newBranch.id },
        include: { vaults: true }
      });
    });

    if (!branch) {
      return NextResponse.json(
        { error: "Failed to create branch record" },
        { status: 500 }
      );
    }

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: (session.user as any).id,
        action: "CREATE_BRANCH",
        entityType: "Branch",
        entityId: branch.id,
        details: `Created branch: ${branch.name} at ${branch.location} via API`,
        timestamp: new Date(),
      },
    });

    return NextResponse.json(
      {
        data: branch,
        message: "Branch created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating branch:", error);
    return NextResponse.json(
      { error: "Failed to create branch" },
      { status: 500 }
    );
  }
}
