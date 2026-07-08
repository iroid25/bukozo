// app/api/v1/deposits/helpers/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";

// GET /api/v1/deposits/helpers - Get helper data for deposit forms
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    // Get members with active accounts
    if (type === "members") {
      const members = await db.member.findMany({
        where: {
          accounts: {
            some: {
              status: "ACTIVE",
            },
          },
        },
        select: {
          id: true,
          memberNumber: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              image: true,
            },
          },
          accounts: {
            where: {
              status: "ACTIVE",
            },
            select: {
              id: true,
              accountNumber: true,
              branch: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          user: {
            name: "asc",
          },
        },
      });

      return NextResponse.json({ data: members });
    }

    // Get institutions with active accounts
    if (type === "institutions") {
      const institutions = await db.institution.findMany({
        where: {
          accounts: {
            some: {
              status: "ACTIVE",
            },
          },
        },
        select: {
          id: true,
          institutionNumber: true,
          institutionName: true,
          institutionType: true,
          institutionEmail: true,
          institutionPhone: true,
          accounts: {
            where: {
              status: "ACTIVE",
            },
            select: {
              id: true,
              accountNumber: true,
              branch: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          institutionName: "asc",
        },
      });

      return NextResponse.json({ data: institutions });
    }

    // Get member's active accounts
    if (type === "memberAccounts") {
      const memberId = searchParams.get("memberId");
      
      if (!memberId) {
        return NextResponse.json(
          { error: "Member ID is required" },
          { status: 400 }
        );
      }

      const accounts = await db.account.findMany({
        where: {
          memberId,
          status: "ACTIVE",
        },
        select: {
          id: true,
          accountNumber: true,
          balance: true,
          accountType: {
            select: {
              id: true,
              name: true,
              minBalance: true,
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
        orderBy: {
          openedAt: "desc",
        },
      });

      return NextResponse.json({ data: accounts });
    }

    // Get institution's active accounts
    if (type === "institutionAccounts") {
      const institutionId = searchParams.get("institutionId");
      
      if (!institutionId) {
        return NextResponse.json(
          { error: "Institution ID is required" },
          { status: 400 }
        );
      }

      const accounts = await db.account.findMany({
        where: {
          institutionId,
          status: "ACTIVE",
        },
        select: {
          id: true,
          accountNumber: true,
          balance: true,
          accountType: {
            select: {
              id: true,
              name: true,
              minBalance: true,
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
        orderBy: {
          openedAt: "desc",
        },
      });

      return NextResponse.json({ data: accounts });
    }

    // Get handler's float balance
    if (type === "floatBalance") {
      const userId = (session.user as any).id;

      const userFloat = await db.userFloat.findUnique({
        where: { userId },
        select: {
          balance: true,
          isActiveForDay: true,
        },
      });

      if (!userFloat) {
        return NextResponse.json(
          { error: "Float not found for this user" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        data: {
          balance: userFloat.balance,
          isActiveForDay: userFloat.isActiveForDay,
        },
      });
    }

    // If no type specified or invalid type, return error
    return NextResponse.json(
      { error: "Invalid or missing helper type parameter" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error fetching deposit helpers:", error);
    return NextResponse.json(
      { error: "Failed to fetch helper data" },
      { status: 500 }
    );
  }
}