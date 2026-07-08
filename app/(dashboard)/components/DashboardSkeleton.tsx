import React, { ReactNode } from "react";

// Animated Pulse Effect Base Component
const PulseWrapper = ({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) => <div className={`animate-pulse ${className || ""}`}>{children}</div>;

// Skeleton for Analytics Card
const AnalyticsCardSkeleton = () => {
  return (
    <div className="overflow-hidden rounded-xl shadow-sm border border-gray-100 bg-white">
      <div className="h-2 bg-gradient-to-r from-gray-200 to-gray-300"></div>
      <div className="p-6">
        <PulseWrapper>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-gray-200"></div>
              <div className="h-5 w-24 bg-gray-200 rounded"></div>
            </div>
            <div className="h-4 w-12 bg-gray-200 rounded"></div>
          </div>

          <div className="mb-3">
            <div className="h-8 w-24 bg-gray-200 rounded mb-1"></div>
            <div className="h-3 w-32 bg-gray-100 rounded"></div>
          </div>

          <div className="grid grid-cols-4 h-8 bg-gray-100 rounded-md overflow-hidden">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="h-full mx-0.5 bg-gray-50"></div>
            ))}
          </div>
        </PulseWrapper>
      </div>
    </div>
  );
};

// Skeleton for Dashboard Cards
export const DashboardCardSkeleton = ({
  height = "auto",
  withTable = false,
}) => {
  return (
    <div className="overflow-hidden rounded-xl shadow-sm bg-white border border-gray-100">
      <div className="px-6 py-5 border-b border-gray-100">
        <PulseWrapper>
          <div className="h-5 w-48 bg-gray-200 rounded mb-2"></div>
          <div className="h-3 w-64 bg-gray-100 rounded"></div>
        </PulseWrapper>
      </div>
      <div className="p-6">
        {height !== "auto" && !withTable ? (
          <PulseWrapper className="flex items-center justify-center">
            <div className={`w-full ${height} bg-gray-100 rounded-lg`}></div>
          </PulseWrapper>
        ) : withTable ? (
          <TableSkeleton rows={5} />
        ) : null}
      </div>
    </div>
  );
};

// Skeleton for Table
const TableSkeleton = ({ rows = 5 }) => {
  return (
    <PulseWrapper className="overflow-x-auto">
      <div className="w-full">
        {/* Table Header */}
        <div className="grid grid-cols-6 gap-4 py-3 bg-gray-50 rounded-t-lg mb-2">
          {[1, 2, 3, 4, 5, 6].map((col) => (
            <div key={col} className="h-5 bg-gray-200 rounded-md"></div>
          ))}
        </div>

        {/* Table Rows */}
        {Array(rows)
          .fill(null)
          .map((_, rowIndex) => (
            <div
              key={rowIndex}
              className="grid grid-cols-6 gap-4 py-4 border-b border-gray-100"
            >
              {[1, 2, 3, 4, 5, 6].map((colIndex) => (
                <div
                  key={colIndex}
                  className={`h-4 ${colIndex === 1 ? "w-full" : "w-4/5"} bg-gray-100 rounded-md`}
                ></div>
              ))}
            </div>
          ))}
      </div>
    </PulseWrapper>
  );
};

// Complete Dashboard Skeleton
const DashboardSkeleton = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto space-y-6 p-6">
        {/* Header Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
          <PulseWrapper>
            <div className="h-7 w-64 bg-gray-200 rounded mb-2"></div>
            <div className="h-4 w-96 bg-gray-100 rounded"></div>
          </PulseWrapper>
          <div className="mt-4 sm:mt-0 flex items-center space-x-3">
            <PulseWrapper className="flex items-center space-x-2">
              <div className="h-4 w-4 bg-gray-200 rounded-full"></div>
              <div className="h-4 w-24 bg-gray-200 rounded"></div>
            </PulseWrapper>
            <PulseWrapper>
              <div className="h-8 w-28 bg-gray-200 rounded-lg"></div>
            </PulseWrapper>
          </div>
        </div>

        {/* Analytics Cards Skeleton */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <AnalyticsCardSkeleton />
          <AnalyticsCardSkeleton />
          <AnalyticsCardSkeleton />
          <AnalyticsCardSkeleton />
        </div>

        {/* Charts and Recent Users Skeleton */}
        <div className="grid gap-6 lg:grid-cols-2">
          <DashboardCardSkeleton height="h-80" />
          <DashboardCardSkeleton withTable={true} />
        </div>

        {/* Top Performing Courses Skeleton */}
        <DashboardCardSkeleton withTable={true} />
      </div>
    </div>
  );
};

export function AnalyticsCardsLoadingSkeleton() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 ">
      <AnalyticsCardSkeleton />
      <AnalyticsCardSkeleton />
      <AnalyticsCardSkeleton />
      <AnalyticsCardSkeleton />
    </div>
  );
}

// Individual component skeletons for more granular loading states
// export const Skeletons = {
//   AnalyticsCard: AnalyticsCardSkeleton,
//   DashboardCard: DashboardCardSkeleton,
//   Table: TableSkeleton,
//   Dashboard: DashboardSkeleton,
// };

// Default export the full dashboard skeleton
export default DashboardSkeleton;
