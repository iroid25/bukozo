// components/Skeletons.tsx
import { ReactNode } from "react";

export function AnalyticsCardsLoadingSkeleton() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      <AnalyticsCardSkeleton />
      <AnalyticsCardSkeleton />
      <AnalyticsCardSkeleton />
      <AnalyticsCardSkeleton />
    </div>
  );
}

export function DashboardTablesLoadingSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <TableSkeleton />
      <TableSkeleton />
    </div>
  );
}

const PulseWrapper = ({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) => <div className={`animate-pulse ${className || ""}`}>{children}</div>;

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
            <div className="h-6 w-32 bg-gray-200 rounded mb-2"></div>
            <div className="h-3 w-32 bg-gray-100 rounded"></div>
          </div>

          <div className="grid grid-cols-3 gap-1">
            {[1, 2, 3].map((item) => (
              <div key={item} className="p-2 bg-gray-50 rounded">
                <div className="h-4 bg-gray-200 rounded mb-1"></div>
                <div className="h-3 bg-gray-100 rounded"></div>
              </div>
            ))}
          </div>
        </PulseWrapper>
      </div>
    </div>
  );
};

const TableSkeleton = () => {
  return (
    <div className="overflow-hidden rounded-xl shadow-sm border border-gray-100 bg-white">
      <div className="p-6">
        <PulseWrapper>
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-gray-200 rounded"></div>
              <div className="h-6 w-32 bg-gray-200 rounded"></div>
            </div>
            <div className="h-8 w-20 bg-gray-200 rounded"></div>
          </div>

          {/* Table Rows */}
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((item) => (
              <div
                key={item}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-200"></div>
                  <div className="space-y-1">
                    <div className="h-4 w-32 bg-gray-200 rounded"></div>
                    <div className="h-3 w-24 bg-gray-100 rounded"></div>
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <div className="h-4 w-20 bg-gray-200 rounded"></div>
                  <div className="h-3 w-16 bg-gray-100 rounded"></div>
                </div>
              </div>
            ))}
          </div>

          {/* Empty State Placeholder */}
          <div className="text-center py-4">
            <div className="w-12 h-12 bg-gray-200 rounded mx-auto mb-2"></div>
            <div className="h-3 w-24 bg-gray-100 rounded mx-auto"></div>
          </div>
        </PulseWrapper>
      </div>
    </div>
  );
};
