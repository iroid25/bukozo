export default function LoanProductDetailsSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Skeleton */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="h-8 bg-gray-200 rounded w-80 mb-2 animate-pulse"></div>
              <div className="h-4 bg-gray-200 rounded w-64 animate-pulse"></div>
            </div>
            <div className="flex gap-2">
              <div className="h-10 bg-gray-200 rounded w-20 animate-pulse"></div>
              <div className="h-10 bg-gray-200 rounded w-24 animate-pulse"></div>
              <div className="h-10 bg-gray-200 rounded w-32 animate-pulse"></div>
            </div>
          </div>
        </div>

        {/* Stats Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="h-4 bg-gray-200 rounded w-28 animate-pulse"></div>
                <div className="h-8 w-8 bg-gray-200 rounded animate-pulse"></div>
              </div>
              <div className="h-8 bg-gray-200 rounded w-24 mb-2 animate-pulse"></div>
              <div className="h-3 bg-gray-200 rounded w-16 animate-pulse"></div>
            </div>
          ))}
        </div>

        {/* Product Details and Edit Form Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Product Details */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="h-6 bg-gray-200 rounded w-48 mb-6 animate-pulse"></div>
            <div className="space-y-4">
              {[...Array(7)].map((_, i) => (
                <div key={i} className="flex justify-between py-2">
                  <div className="h-4 bg-gray-200 rounded w-32 animate-pulse"></div>
                  <div className="h-4 bg-gray-200 rounded w-24 animate-pulse"></div>
                </div>
              ))}
            </div>
          </div>

          {/* Edit Form */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="h-6 bg-gray-200 rounded w-48 mb-6 animate-pulse"></div>
            <div className="space-y-4">
              {[...Array(6)].map((_, i) => (
                <div key={i}>
                  <div className="h-4 bg-gray-200 rounded w-24 mb-2 animate-pulse"></div>
                  <div className="h-10 bg-gray-200 rounded w-full animate-pulse"></div>
                </div>
              ))}
              <div className="flex gap-2 pt-4">
                <div className="h-10 bg-gray-200 rounded w-24 animate-pulse"></div>
                <div className="h-10 bg-gray-200 rounded w-20 animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Applications Table Skeleton */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex justify-between items-center">
              <div className="h-6 bg-gray-200 rounded w-48 animate-pulse"></div>
              <div className="h-8 bg-gray-200 rounded w-32 animate-pulse"></div>
            </div>
          </div>

          <div className="p-6">
            {/* Table Header Skeleton */}
            <div className="grid grid-cols-6 gap-4 mb-4">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="h-4 bg-gray-200 rounded animate-pulse"
                ></div>
              ))}
            </div>

            {/* Table Rows Skeleton */}
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="grid grid-cols-6 gap-4 py-4 border-b border-gray-100"
              >
                {[...Array(6)].map((_, j) => (
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
