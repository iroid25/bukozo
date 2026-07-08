"use server";

import { db } from "@/prisma/db";
import {
  DollarSign,
  LayoutGrid,
  LucideProps,
  Users,
  Users2,
} from "lucide-react";
export type AnalyticsProps = {
  title: string;
  total: number;
  href: string;
  icon: any;
  isCurrency?: boolean;
};
export async function getDashboardOverview() {
  try {
    const usersLength = await db.user.count();

    const analytics = [
      {
        title: "Total Savings",
        total: 0,
        href: "/dashboard/savings",
        icon: DollarSign,
        isCurrency: true,
      },
      {
        title: "Users",
        total: usersLength,
        href: "/dashboard/users",
        icon: Users,
      },
    ];

    return analytics;
  } catch (error) {
    console.log(error);
    return null;
  }
}
