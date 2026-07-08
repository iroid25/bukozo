// components/my-account/MyAccountLoading.tsx
export default function MyAccountLoading() {
  return (
    <div className="container mx-auto py-6">
      {/* Profile Header Skeleton */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 bg-gray-200 rounded-full animate-pulse"></div>
            <div className="space-y-2">
              <div className="h-6 w-48 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div>
              <div className="space-y-1">
                <div className="h-3 w-56 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-3 w-40 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-3 w-44 bg-gray-200 rounded animate-pulse"></div>
              </div>
            </div>
          </div>

          {/* Quick Stats Skeleton */}
          <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 md:ml-auto">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-gray-50 p-4 rounded-lg">
                <div className="h-4 w-20 bg-gray-200 rounded animate-pulse mb-2"></div>
                <div className="h-6 w-16 bg-gray-200 rounded animate-pulse"></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Financial Overview Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-4 w-4 bg-gray-200 rounded animate-pulse"></div>
            </div>
            <div className="h-8 w-20 bg-gray-200 rounded animate-pulse mb-2"></div>
            <div className="h-3 w-32 bg-gray-200 rounded animate-pulse"></div>
          </div>
        ))}
      </div>

      {/* Account and Loans Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-5 w-5 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-5 w-32 bg-gray-200 rounded animate-pulse"></div>
            </div>
            <div className="space-y-4">
              {[...Array(3)].map((_, j) => (
                <div
                  key={j}
                  className="flex justify-between items-center p-4 border border-gray-200 rounded-lg"
                >
                  <div className="space-y-2">
                    <div className="h-4 w-28 bg-gray-200 rounded animate-pulse"></div>
                    <div className="h-3 w-36 bg-gray-200 rounded animate-pulse"></div>
                    <div className="h-3 w-44 bg-gray-200 rounded animate-pulse"></div>
                  </div>
                  <div className="text-right space-y-2">
                    <div className="h-5 w-24 bg-gray-200 rounded animate-pulse"></div>
                    <div className="h-3 w-20 bg-gray-200 rounded animate-pulse"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Transaction Breakdown Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-5 w-5 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-5 w-32 bg-gray-200 rounded animate-pulse"></div>
            </div>
            <div className="space-y-3">
              {[...Array(3)].map((_, j) => (
                <div
                  key={j}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-5 w-5 bg-gray-200 rounded animate-pulse"></div>
                    <div className="space-y-1">
                      <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
                      <div className="h-3 w-32 bg-gray-200 rounded animate-pulse"></div>
                    </div>
                  </div>
                  <div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Transactions Table Skeleton */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="space-y-2">
            <div className="h-6 w-48 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-4 w-64 bg-gray-200 rounded animate-pulse"></div>
          </div>
          <div className="flex gap-2">
            <div className="h-9 w-24 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-9 w-20 bg-gray-200 rounded animate-pulse"></div>
          </div>
        </div>

        {/* Table Header Skeleton */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 p-4 border-b">
            <div className="grid grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="h-4 bg-gray-200 rounded animate-pulse"
                ></div>
              ))}
            </div>
          </div>

          {/* Table Rows Skeleton */}
          {[...Array(10)].map((_, i) => (
            <div
              key={i}
              className="p-4 border-b border-gray-100 last:border-b-0"
            >
              <div className="grid grid-cols-4 gap-4">
                {[...Array(4)].map((_, j) => (
                  <div key={j} className="space-y-2">
                    <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                    <div className="h-3 bg-gray-200 rounded animate-pulse w-3/4"></div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
