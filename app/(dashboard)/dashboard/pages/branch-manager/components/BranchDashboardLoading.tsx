import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function BranchDashboardLoading() {
  return (
    <div className="flex flex-col gap-8 p-6 pt-2 h-full w-full">
      {/* Station Header Skeleton */}
      <div className="h-48 w-full rounded-3xl bg-neutral-100 animate-pulse" />

      {/* Metric Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="border-none shadow-sm">
            <CardContent className="p-6">
              <Skeleton className="h-10 w-10 rounded-2xl mb-4" />
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[300px] w-full rounded-xl" />
            </CardContent>
          </Card>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="h-64 shadow-sm" />
            <Card className="h-64 shadow-sm" />
          </div>
        </div>
        <div className="space-y-8">
          <Card className="h-[400px] shadow-sm" />
          <Card className="h-[200px] shadow-sm" />
        </div>
      </div>
    </div>
  );
}
