// app/api/v1/branches/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";

// GET /api/v1/branches/[id] - Fetch a single branch
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const branch = await db.branch.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            accounts: true,
            loans: true,
          },
        },
      },
    });

    if (!branch) {
      return NextResponse.json({ error: "Branch not found" }, { status: 404 });
    }

    return NextResponse.json({ data: branch });
  } catch (error) {
    console.error("Error fetching branch:", error);
    return NextResponse.json(
      { error: "Failed to fetch branch" },
      { status: 500 }
    );
  }
}

// PUT /api/v1/branches/[id] - Update a branch
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any).role;

    if (!["ADMIN"].includes(userRole)) {
      return NextResponse.json(
        { error: "Only admins can update branches" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    // Check if branch exists
    const existing = await db.branch.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json({ error: "Branch not found" }, { status: 404 });
    }

    // If name is being updated, check for duplicates
    if (body.name && body.name !== existing.name) {
      const duplicate = await db.branch.findUnique({
        where: { name: body.name },
      });

      if (duplicate) {
        return NextResponse.json(
          { error: "Branch with this name already exists" },
          { status: 409 }
        );
      }
    }

    // Update branch
    const branch = await db.branch.update({
      where: { id },
      data: {
        name: body.name?.trim(),
        location: body.location?.trim(),
        contactPerson: body.contactPerson?.trim() || null,
        contactPhone: body.contactPhone?.trim() || null,
        email: body.email?.trim() || null,
        accountantId: body.accountantId || null,
        managerId: body.managerId || null,
      },
      include: { vaults: true }
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: (session.user as any).id,
        action: "UPDATE_BRANCH",
        entityType: "Branch",
        entityId: id,
        details: `Updated branch: ${branch.name} via API`,
        timestamp: new Date(),
      },
    });

    return NextResponse.json({
      data: branch,
      message: "Branch updated successfully",
    });
  } catch (error) {
    console.error("Error updating branch:", error);
    return NextResponse.json(
      { error: "Failed to update branch" },
      { status: 500 }
    );
  }
}

// DELETE /api/v1/branches/[id] - Delete a branch
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any).role;

    if (!["ADMIN"].includes(userRole)) {
      return NextResponse.json(
        { error: "Only admins can delete branches" },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Check if branch exists
    const existing = await db.branch.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            accounts: true,
            loans: true,
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Branch not found" }, { status: 404 });
    }

    // Check if branch has related data
    if (
      existing._count.users > 0 ||
      existing._count.accounts > 0 ||
      existing._count.loans > 0
    ) {
      return NextResponse.json(
        {
          error:
            "Cannot delete branch with existing users, accounts, or loans",
        },
        { status: 400 }
      );
    }

    // Delete branch
    await db.branch.delete({ where: { id } });

    return NextResponse.json({
      message: "Branch deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting branch:", error);
    return NextResponse.json(
      { error: "Failed to delete branch" },
      { status: 500 }
    );
  }
}