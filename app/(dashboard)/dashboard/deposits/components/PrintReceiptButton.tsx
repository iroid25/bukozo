"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface PrintReceiptButtonProps {
  id: string;
  prefix?: string;
}

export default function PrintReceiptButton({ id, prefix = "deposits" }: PrintReceiptButtonProps) {
  const open = (size: "58mm" | "80mm") => {
    const url = `/print/${prefix}/${id}?size=${size}`;
    const win = window.open(url, "_blank");
    if (win) win.focus();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Printer className="h-4 w-4 mr-2" />
          Print Receipt
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Paper Roll Size</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => open("80mm")}>
          <Printer className="h-3.5 w-3.5 mr-2" />
          80mm (3-inch) — standard
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => open("58mm")}>
          <Printer className="h-3.5 w-3.5 mr-2" />
          58mm (2-inch) — compact
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
