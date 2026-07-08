import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function AccountantDashboardLoading() {
  return (
    <div className="flex flex-col gap-8 p-6 pt-2 h-full w-full">
      {/* Financial Hero Skeleton */}
      <div className="h-56 w-full rounded-[32px] bg-neutral-100 animate-pulse" />

      {/* Strategic Metrics Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="border-none shadow-sm h-40">
            <CardContent className="p-6">
              <Skeleton className="h-12 w-12 rounded-3xl mb-4" />
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card className="border-none shadow-sm h-[400px]">
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[280px] w-full rounded-xl" />
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm h-64" />
        </div>
        <div className="space-y-8">
          <Card className="h-[400px] shadow-sm border-none rounded-3xl bg-neutral-900" />
          <Card className="h-80 shadow-sm border-none" />
        </div>
      </div>
    </div>
  );
}
