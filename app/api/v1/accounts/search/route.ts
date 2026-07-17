import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q") || "";
    const initial = searchParams.get("initial") === "true";
    const includeInactive = searchParams.get("includeInactive") === "true";
    const savingsOnly = searchParams.get("savingsOnly") === "true";

    if (!initial && (!query || query.length < 2)) {
      return NextResponse.json({ data: [] });
    }

    const accounts = await db.account.findMany({
      where: {
        ...(includeInactive ? {} : { status: { equals: "ACTIVE" as const } }),
        ...(savingsOnly ? { accountType: { isShareAccount: false } } : {}),
        ...(initial
          ? {}
          : {
              OR: [
                { accountNumber: { contains: query, mode: "insensitive" as const } },
                { member: { user: { name: { contains: query, mode: "insensitive" as const } } } },
                { member: { user: { phone: { contains: query } } } },
                { institution: { institutionName: { contains: query, mode: "insensitive" as const } } },
                { institution: { user: { name: { contains: query, mode: "insensitive" as const } } } },
              ],
            }),
      },
      select: {
        id: true,
        accountNumber: true,
        balance: true,
        status: true,
        accountType: {
          select: {
            name: true,
          },
        },
        member: {
          select: {
            user: {
              select: {
                name: true,
                phone: true,
              },
            },
          },
        },
        institution: {
          select: {
            institutionName: true,
            user: {
              select: {
                name: true,
                phone: true,
              },
            },
          },
        },
      },
      take: 20,
      orderBy: {
        accountNumber: "asc",
      },
    });

    // Format the response
    const formattedAccounts = accounts.map((account) => ({
      id: account.id,
      accountNumber: account.accountNumber,
      memberName: account.member?.user?.name || account.institution?.user?.name || account.institution?.institutionName || "Unknown",
      memberPhone: account.member?.user?.phone || account.institution?.user?.phone || "",
      accountType: account.accountType?.name || "Unknown",
      balance: account.balance,
      isActive: account.status === "ACTIVE",
    }));

    return NextResponse.json({ data: formattedAccounts });
  } catch (error) {
    console.error("Account search error:", error);
    return NextResponse.json(
      { error: "Failed to search accounts" },
      { status: 500 }
    );
  }
}
