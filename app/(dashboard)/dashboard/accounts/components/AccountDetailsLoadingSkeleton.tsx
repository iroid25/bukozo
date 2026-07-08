export default function AccountDetailsSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Skeleton */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="h-8 bg-gray-200 rounded w-64 mb-2 animate-pulse"></div>
              <div className="h-4 bg-gray-200 rounded w-48 animate-pulse"></div>
            </div>
            <div className="flex gap-2">
              <div className="h-10 bg-gray-200 rounded w-24 animate-pulse"></div>
              <div className="h-10 bg-gray-200 rounded w-32 animate-pulse"></div>
            </div>
          </div>
        </div>

        {/* Account Info Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="h-4 bg-gray-200 rounded w-24 animate-pulse"></div>
                <div className="h-8 w-8 bg-gray-200 rounded animate-pulse"></div>
              </div>
              <div className="h-8 bg-gray-200 rounded w-32 mb-2 animate-pulse"></div>
              <div className="h-3 bg-gray-200 rounded w-20 animate-pulse"></div>
            </div>
          ))}
        </div>

        {/* Member Info Skeleton */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="h-6 bg-gray-200 rounded w-48 mb-6 animate-pulse"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="flex items-center space-x-4">
              <div className="h-16 w-16 bg-gray-200 rounded-full animate-pulse"></div>
              <div>
                <div className="h-5 bg-gray-200 rounded w-32 mb-2 animate-pulse"></div>
                <div className="h-4 bg-gray-200 rounded w-24 animate-pulse"></div>
              </div>
            </div>
            {[...Array(6)].map((_, i) => (
              <div key={i}>
                <div className="h-4 bg-gray-200 rounded w-20 mb-2 animate-pulse"></div>
                <div className="h-5 bg-gray-200 rounded w-32 animate-pulse"></div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs Skeleton */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="border-b border-gray-200 px-6">
            <div className="flex space-x-8">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-12 flex items-center">
                  <div className="h-4 bg-gray-200 rounded w-20 animate-pulse"></div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-6">
            {/* Table Header Skeleton */}
            <div className="grid grid-cols-5 gap-4 mb-4">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="h-4 bg-gray-200 rounded animate-pulse"
                ></div>
              ))}
            </div>

            {/* Table Rows Skeleton */}
            {[...Array(10)].map((_, i) => (
              <div
                key={i}
                className="grid grid-cols-5 gap-4 py-4 border-b border-gray-100"
              >
                {[...Array(5)].map((_, j) => (
                  <div
                    key={j}
                    className="h-4 bg-gray-200 rounded animate-pulse"
                  ></div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
