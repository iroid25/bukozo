import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Users, Car } from "lucide-react";

import Link from "next/link";
// Loading components
export function StatsLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-80" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array(8)
          .fill(0)
          .map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4 rounded-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-28 mb-1" />
                <Skeleton className="h-3 w-40" />
              </CardContent>
            </Card>
          ))}
      </div>
    </div>
  );
}

// Recent Activity Loading
export function RecentActivityLoading() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32 mb-2" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-8">
            {Array(5)
              .fill(0)
              .map((_, i) => (
                <div key={i} className="flex items-center">
                  <Skeleton className="h-9 w-9 rounded-full mr-3" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-64" />
                  </div>
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center">
          <div className="flex-1">
            <Skeleton className="h-6 w-32 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-8 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
