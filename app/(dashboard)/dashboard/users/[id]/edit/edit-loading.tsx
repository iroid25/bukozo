// app/dashboard/members/[id]/edit/edit-loading.tsx
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export default function EditMemberLoading() {
  return (
    <div className="container py-10 animate-pulse">
      {/* Header Section */}
      <div className="mb-8 space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-full bg-muted"></div>
          <Skeleton className="h-4 w-32" />
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <Skeleton className="h-9 w-[350px] mb-2" />
            <Skeleton className="h-5 w-[400px]" />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" disabled>
              Preview
            </Button>
            <Button variant="default" disabled>
              Approve Member
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="w-full p-0 border-b rounded-none mb-6 relative">
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-muted"></div>
        <div className="flex gap-1 overflow-x-auto">
          <div className="py-3 px-4 relative whitespace-nowrap">
            <Skeleton className="h-5 w-24" />
            <div className="absolute bottom-0 left-0 right-0 h-0.5bg-[#1e40af]"></div>
          </div>
          <div className="py-3 px-4 whitespace-nowrap">
            <Skeleton className="h-5 w-20" />
          </div>
          <div className="py-3 px-4 whitespace-nowrap">
            <Skeleton className="h-5 w-24" />
          </div>
          <div className="py-3 px-4 whitespace-nowrap">
            <Skeleton className="h-5 w-16" />
          </div>
          <div className="py-3 px-4 whitespace-nowrap">
            <Skeleton className="h-5 w-20" />
          </div>
          <div className="py-3 px-4 whitespace-nowrap">
            <Skeleton className="h-5 w-28" />
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid gap-6 mt-6">
        {/* Personal Info Card */}
        <div className="border rounded-lg p-6 space-y-6">
          <div className="flex justify-between items-center">
            <Skeleton className="h-6 w-40" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
          <div className="pt-2">
            <Skeleton className="h-10 w-40" />
          </div>
        </div>

        {/* Family Info Card */}
        <div className="border rounded-lg p-6 space-y-6">
          <div className="flex justify-between items-center">
            <Skeleton className="h-6 w-36" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
          <div className="pt-2">
            <Skeleton className="h-10 w-40" />
          </div>
        </div>

        {/* Background Info Card */}
        <div className="border rounded-lg p-6 space-y-6">
          <div className="flex justify-between items-center">
            <Skeleton className="h-6 w-44" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
          <div className="pt-2">
            <Skeleton className="h-10 w-40" />
          </div>
        </div>
      </div>
    </div>
  );
}
