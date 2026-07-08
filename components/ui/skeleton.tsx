import { cn } from "@/lib/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-mdbg-[#1e40af]/10", className)}
      {...props}
    />
  );
}

export { Skeleton };
