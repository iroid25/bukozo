import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function MemberDashboardLoading() {
  return (
    <div className="flex flex-col gap-8 p-6 pt-2 h-full w-full max-w-7xl mx-auto">
      {/* Welcome Header Skeleton */}
      <div className="flex justify-between items-center w-full">
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-11 w-28 rounded-2xl" />
          <Skeleton className="h-11 w-32 rounded-2xl" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Wealth Card Skeleton */}
          <Skeleton className="h-64 w-full rounded-[30px]" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
               <Skeleton className="h-4 w-24 px-1" />
               <Skeleton className="h-32 w-full rounded-[24px]" />
               <Skeleton className="h-32 w-full rounded-[24px]" />
            </div>
            <div className="space-y-4">
               <Skeleton className="h-4 w-24 px-1" />
               <div className="grid grid-cols-2 gap-4">
                  <Skeleton className="h-28 rounded-[24px]" />
                  <Skeleton className="h-28 rounded-[24px]" />
                  <Skeleton className="h-28 rounded-[24px]" />
                  <Skeleton className="h-28 rounded-[24px]" />
               </div>
            </div>
          </div>
        </div>

        <div className="h-full">
           <Card className="rounded-[30px] border-none shadow-sm h-[600px] overflow-hidden">
              <CardHeader>
                 <Skeleton className="h-10 w-48" />
              </CardHeader>
              <CardContent className="space-y-4">
                 {[1, 2, 3, 4, 5].map(i => (
                   <div key={i} className="flex gap-4 items-center">
                      <Skeleton className="h-10 w-10 rounded-xl" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-3 w-1/3" />
                      </div>
                      <Skeleton className="h-4 w-16" />
                   </div>
                 ))}
              </CardContent>
           </Card>
        </div>
      </div>
    </div>
  );
}
