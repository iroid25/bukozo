import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface ReportSummaryCardProps {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  subValue?: string;
  className?: string;
}

export function ReportSummaryCard({
  title,
  value,
  icon: Icon,
  subValue,
  className,
}: ReportSummaryCardProps) {
  return (
    <Card className={`relative flex h-full min-h-[120px] w-full min-w-0 flex-col justify-center ${className || ""}`}>
      {Icon ? <Icon className="absolute right-4 top-4 h-4 w-4 text-muted-foreground" /> : null}
      <CardHeader className="flex min-w-0 flex-1 flex-col items-center justify-center gap-2 space-y-0 pb-1 pt-4 text-center">
        <CardTitle className="min-w-0 text-center text-[11px] font-semibold uppercase tracking-wide leading-tight text-slate-500 sm:text-xs">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="min-w-0 flex-1 pb-4 pt-0 text-center">
        <div
          className="w-full max-w-full px-2 text-[clamp(1.05rem,1.75vw,1.85rem)] font-bold leading-tight tracking-tight text-slate-950 break-words"
          title={String(value)}
        >
          {value}
        </div>
        {subValue && (
          <p className="mt-2 text-xs text-muted-foreground">{subValue}</p>
        )}
      </CardContent>
    </Card>
  );
}
