import { NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";
import { initializeAccountantVault } from "@/actions/incomeandexp/vault/vault";
import { UserRole } from "@prisma/client";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const accountant = await db.user.findFirst({
      where: { role: UserRole.ACCOUNTANT },
    });

    if (!accountant) {
      const manager = await db.user.findFirst({
        where: { role: UserRole.BRANCHMANAGER },
      });
      if (!manager) return NextResponse.json({ error: "No accountant or manager found" });

      const result = await initializeAccountantVault(manager.id);
      return NextResponse.json({ testUser: manager.name, role: manager.role, result });
    }

    const result = await initializeAccountantVault(accountant.id);
    return NextResponse.json({ testUser: accountant.name, role: accountant.role, result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, stack: error.stack });
  }
}
