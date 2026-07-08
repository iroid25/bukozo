// "use client";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Badge } from "@/components/ui/badge";
// import {
//   TrendingUp,
//   TrendingDown,
//   Users,
//   UserCheck,
//   Banknote,
//   CreditCard,
//   Smartphone,
//   FileText,
//   Building,
//   DollarSign,
// } from "lucide-react";
// import {
//   DashboardAnalytics,
//   AnalyticsTimeframe,
//   MoneyAnalyticsTimeframe,
// } from "@/actions/dashboard";

// interface AnalyticsCardsProps {
//   analytics: DashboardAnalytics;
//   userRole: string;
// }

// interface MetricCardProps {
//   title: string;
//   icon: React.ElementType;
//   data: AnalyticsTimeframe | MoneyAnalyticsTimeframe;
//   color: string;
//   isMoneyMetric?: boolean;
// }

// function formatCurrency(amount: number) {
//   return new Intl.NumberFormat("en-UG", {
//     style: "currency",
//     currency: "UGX",
//     minimumFractionDigits: 0,
//   }).format(amount);
// }

// function formatNumber(num: number) {
//   if (num >= 1000000) {
//     return (num / 1000000).toFixed(1) + "M";
//   }
//   if (num >= 1000) {
//     return (num / 1000).toFixed(1) + "K";
//   }
//   return num.toString();
// }

// function calculateGrowth(
//   current: number,
//   previous: number
// ): { percentage: number; isPositive: boolean } {
//   if (previous === 0) return { percentage: 0, isPositive: true };
//   const percentage = ((current - previous) / previous) * 100;
//   return { percentage: Math.abs(percentage), isPositive: percentage >= 0 };
// }

// function MetricCard({
//   title,
//   icon: Icon,
//   data,
//   color,
//   isMoneyMetric = false,
// }: MetricCardProps) {
//   const todayValue = isMoneyMetric
//     ? (data as MoneyAnalyticsTimeframe).today.count.id
//     : (data as AnalyticsTimeframe).today;

//   const weekValue = isMoneyMetric
//     ? (data as MoneyAnalyticsTimeframe).week.count.id
//     : (data as AnalyticsTimeframe).week;

//   const totalValue = isMoneyMetric
//     ? (data as MoneyAnalyticsTimeframe).total.count.id
//     : (data as AnalyticsTimeframe).total;

//   const totalAmount = isMoneyMetric
//     ? (data as MoneyAnalyticsTimeframe).total.amount
//     : 0;

//   const growth = calculateGrowth(weekValue, weekValue - todayValue);

//   return (
//     <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-200">
//       <div className={`h-2 bg-gradient-to-r ${color}`}></div>
//       <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
//         <CardTitle className="text-sm font-medium text-gray-600">
//           {title}
//         </CardTitle>
//         <div className="flex items-center gap-2">
//           <Icon className="h-4 w-4 text-gray-400" />
//           {growth.percentage > 0 && (
//             <Badge
//               variant={growth.isPositive ? "default" : "destructive"}
//               className="text-xs"
//             >
//               {growth.isPositive ? (
//                 <TrendingUp className="w-3 h-3 mr-1" />
//               ) : (
//                 <TrendingDown className="w-3 h-3 mr-1" />
//               )}
//               {growth.percentage.toFixed(1)}%
//             </Badge>
//           )}
//         </div>
//       </CardHeader>
//       <CardContent>
//         <div className="mb-3">
//           {isMoneyMetric ? (
//             <div>
//               <div className="text-2xl font-bold text-gray-900">
//                 {formatNumber(totalValue)}
//               </div>
//               <div className="text-lg font-semibold text-green-600">
//                 {formatCurrency(totalAmount)}
//               </div>
//             </div>
//           ) : (
//             <div className="text-2xl font-bold text-gray-900">
//               {formatNumber(totalValue)}
//             </div>
//           )}
//           <p className="text-xs text-gray-500">Total {title.toLowerCase()}</p>
//         </div>

//         <div className="grid grid-cols-3 gap-1 text-xs">
//           <div className="text-center p-2 bg-gray-50 rounded">
//             <div className="font-medium text-gray-900">{todayValue}</div>
//             <div className="text-gray-500">Today</div>
//           </div>
//           <div className="text-center p-2 bg-blue-50 rounded">
//             <div className="font-medium text-blue-900">{weekValue}</div>
//             <div className="text-blue-600">7 Days</div>
//           </div>
//           <div className="text-center p-2 bg-green-50 rounded">
//             <div className="font-medium text-green-900">
//               {isMoneyMetric
//                 ? (data as MoneyAnalyticsTimeframe).month.count.id
//                 : (data as AnalyticsTimeframe).month}
//             </div>
//             <div className="text-green-600">28 Days</div>
//           </div>
//         </div>
//       </CardContent>
//     </Card>
//   );
// }

// // Role-based metric configurations
// const getRoleMetrics = (analytics: DashboardAnalytics, userRole: string) => {
//   const allMetrics = {
//     users: {
//       title: "Total Users",
//       icon: Users,
//       data: analytics.users,
//       color: "from-blue-400 to-blue-600",
//       isMoneyMetric: false,
//     },
//     members: {
//       title: "Active Members",
//       icon: UserCheck,
//       data: analytics.members,
//       color: "from-green-400 to-green-600",
//       isMoneyMetric: false,
//     },
//     deposits: {
//       title: "Deposits",
//       icon: TrendingUp,
//       data: analytics.deposits,
//       color: "from-emerald-400 to-emerald-600",
//       isMoneyMetric: true,
//     },
//     withdrawals: {
//       title: "Withdrawals",
//       icon: TrendingDown,
//       data: analytics.withdrawals,
//       color: "from-red-400 to-red-600",
//       isMoneyMetric: true,
//     },
//     loans: {
//       title: "Loans Disbursed",
//       icon: Banknote,
//       data: analytics.loans,
//       color: "from-purple-400 to-purple-600",
//       isMoneyMetric: true,
//     },
//     mobileDeposits: {
//       title: "Mobile Money Deposits",
//       icon: Smartphone,
//       data: analytics.mobileMoneyDeposits,
//       color: "from-orange-400 to-orange-600",
//       isMoneyMetric: true,
//     },
//     accounts: {
//       title: "Active Accounts",
//       icon: CreditCard,
//       data: analytics.accounts,
//       color: "from-indigo-400 to-indigo-600",
//       isMoneyMetric: false,
//     },
//     statements: {
//       title: "Statements Generated",
//       icon: FileText,
//       data: analytics.statements,
//       color: "from-teal-400 to-teal-600",
//       isMoneyMetric: false,
//     },
//   };

//   // Role-based metric selection
//   switch (userRole) {
//     case "ADMIN":
//       return [
//         allMetrics.members,
//         allMetrics.deposits,
//         allMetrics.loans,
//         allMetrics.users,
//       ];
//     case "BRANCHMANAGER":
//       return [
//         allMetrics.members,
//         allMetrics.deposits,
//         allMetrics.withdrawals,
//         allMetrics.accounts,
//       ];
//     case "TELLER":
//       return [
//         allMetrics.deposits,
//         allMetrics.withdrawals,
//         allMetrics.mobileDeposits,
//         allMetrics.accounts,
//       ];
//     case "AGENT":
//       return [
//         allMetrics.mobileDeposits,
//         allMetrics.deposits,
//         allMetrics.members,
//         allMetrics.statements,
//       ];
//     default: // MEMBER
//       return [
//         allMetrics.members,
//         allMetrics.accounts,
//         allMetrics.statements,
//         allMetrics.deposits,
//       ];
//   }
// };

// export default function AnalyticsCards({
//   analytics,
//   userRole,
// }: AnalyticsCardsProps) {
//   const metrics = getRoleMetrics(analytics, userRole);

//   return (
//     <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
//       {metrics.map((metric, index) => (
//         <MetricCard
//           key={index}
//           title={metric.title}
//           icon={metric.icon}
//           data={metric.data}
//           color={metric.color}
//           isMoneyMetric={metric.isMoneyMetric}
//         />
//       ))}
//     </div>
//   );
// }
"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  TrendingDown,
  Users,
  UserCheck,
  Banknote,
  CreditCard,
  Smartphone,
  FileText,
  Building,
  DollarSign,
} from "lucide-react";
import type {
  DashboardAnalytics,
  AnalyticsTimeframe,
  MoneyAnalyticsTimeframe,
} from "@/actions/dashboard";

interface AnalyticsCardsProps {
  analytics: DashboardAnalytics;
  userRole: string;
}

interface MetricCardProps {
  title: string;
  icon: React.ElementType;
  data: AnalyticsTimeframe | MoneyAnalyticsTimeframe;
  color: string;
  isMoneyMetric?: boolean;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatNumber(num: number) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toString();
}

function calculateGrowth(
  current: number,
  previous: number
): { percentage: number; isPositive: boolean } {
  if (previous === 0) return { percentage: 0, isPositive: true };
  const percentage = ((current - previous) / previous) * 100;
  return { percentage: Math.abs(percentage), isPositive: percentage >= 0 };
}

function MetricCard({
  title,
  icon: Icon,
  data,
  color,
  isMoneyMetric = false,
}: MetricCardProps) {
  // Add safety checks for nested properties
  const todayValue = isMoneyMetric
    ? (data as MoneyAnalyticsTimeframe)?.today?.count?.id || 0
    : (data as AnalyticsTimeframe)?.today || 0;

  const weekValue = isMoneyMetric
    ? (data as MoneyAnalyticsTimeframe)?.week?.count?.id || 0
    : (data as AnalyticsTimeframe)?.week || 0;

  const totalValue = isMoneyMetric
    ? (data as MoneyAnalyticsTimeframe)?.total?.count?.id || 0
    : (data as AnalyticsTimeframe)?.total || 0;

  const totalAmount = isMoneyMetric
    ? (data as MoneyAnalyticsTimeframe)?.total?.amount || 0
    : 0;

  const monthValue = isMoneyMetric
    ? (data as MoneyAnalyticsTimeframe)?.month?.count?.id || 0
    : (data as AnalyticsTimeframe)?.month || 0;

  const growth = calculateGrowth(weekValue, weekValue - todayValue);

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-200">
      <div className={`h-2 bg-gradient-to-r ${color}`}></div>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-600">
          {title}
        </CardTitle>
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-gray-400" />
          {growth.percentage > 0 && (
            <Badge
              variant={growth.isPositive ? "default" : "destructive"}
              className="text-xs"
            >
              {growth.isPositive ? (
                <TrendingUp className="w-3 h-3 mr-1" />
              ) : (
                <TrendingDown className="w-3 h-3 mr-1" />
              )}
              {growth.percentage.toFixed(1)}%
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-3">
          {isMoneyMetric ? (
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {formatNumber(totalValue)}
              </div>
              <div className="text-lg font-semibold text-green-600">
                {formatCurrency(totalAmount)}
              </div>
            </div>
          ) : (
            <div className="text-2xl font-bold text-gray-900">
              {formatNumber(totalValue)}
            </div>
          )}
          <p className="text-xs text-gray-500">Total {title.toLowerCase()}</p>
        </div>

        <div className="grid grid-cols-3 gap-1 text-xs">
          <div className="text-center p-2 bg-gray-50 rounded">
            <div className="font-medium text-gray-900">{todayValue}</div>
            <div className="text-gray-500">Today</div>
          </div>
          <div className="text-center p-2 bg-blue-50 rounded">
            <div className="font-medium text-blue-900">{weekValue}</div>
            <div className="text-blue-600">7 Days</div>
          </div>
          <div className="text-center p-2 bg-green-50 rounded">
            <div className="font-medium text-green-900">{monthValue}</div>
            <div className="text-green-600">28 Days</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Role-based metric configurations
const getRoleMetrics = (analytics: DashboardAnalytics, userRole: string) => {
  const allMetrics = {
    users: {
      title: "Total Users",
      icon: Users,
      data: analytics.users,
      color: "from-blue-400 to-blue-600",
      isMoneyMetric: false,
    },
    members: {
      title: "Active Members",
      icon: UserCheck,
      data: analytics.members,
      color: "from-green-400 to-green-600",
      isMoneyMetric: false,
    },
    deposits: {
      title: "Deposits",
      icon: TrendingUp,
      data: analytics.deposits,
      color: "from-emerald-400 to-emerald-600",
      isMoneyMetric: true,
    },
    withdrawals: {
      title: "Withdrawals",
      icon: TrendingDown,
      data: analytics.withdrawals,
      color: "from-red-400 to-red-600",
      isMoneyMetric: true,
    },
    loans: {
      title: "Loans Disbursed",
      icon: Banknote,
      data: analytics.loans,
      color: "from-purple-400 to-purple-600",
      isMoneyMetric: true,
    },
    mobileDeposits: {
      title: "Mobile Money Deposits",
      icon: Smartphone,
      data: analytics.mobileMoneyDeposits,
      color: "from-orange-400 to-orange-600",
      isMoneyMetric: true,
    },
    accounts: {
      title: "Active Accounts",
      icon: CreditCard,
      data: analytics.accounts,
      color: "from-indigo-400 to-indigo-600",
      isMoneyMetric: false,
    },
    statements: {
      title: "Statements Generated",
      icon: FileText,
      data: analytics.statements,
      color: "from-teal-400 to-teal-600",
      isMoneyMetric: false,
    },
  };

  // Role-based metric selection
  switch (userRole) {
    case "ADMIN":
      return [
        allMetrics.members,
        allMetrics.deposits,
        allMetrics.loans,
        allMetrics.users,
      ];
    case "BRANCHMANAGER":
      return [
        allMetrics.members,
        allMetrics.deposits,
        allMetrics.withdrawals,
        allMetrics.accounts,
      ];
    case "TELLER":
      return [
        allMetrics.deposits,
        allMetrics.withdrawals,
        allMetrics.mobileDeposits,
        allMetrics.accounts,
      ];
    case "AGENT":
      return [
        allMetrics.mobileDeposits,
        allMetrics.deposits,
        allMetrics.members,
        allMetrics.statements,
      ];
    default: // MEMBER
      return [
        allMetrics.members,
        allMetrics.accounts,
        allMetrics.statements,
        allMetrics.deposits,
      ];
  }
};

export default function AnalyticsCards({
  analytics,
  userRole,
}: AnalyticsCardsProps) {
  // Add safety check for analytics data
  if (!analytics) {
    return (
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((index) => (
          <Card key={index} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const metrics = getRoleMetrics(analytics, userRole);

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric, index) => (
        <MetricCard
          key={index}
          title={metric.title}
          icon={metric.icon}
          data={metric.data}
          color={metric.color}
          isMoneyMetric={metric.isMoneyMetric}
        />
      ))}
    </div>
  );
}
