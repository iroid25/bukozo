"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { UserCheck, User, Mail, Phone } from "lucide-react";
import { Loan } from "@/types/loan";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface LoanProfileProps {
  member: Loan["member"] & {
    accounts: Array<{
      id: string;
      accountNumber: string;
      balance: number;
      accountType: { name: string };
    }>;
  };
}

export default function LoanProfile({ member }: LoanProfileProps) {
  const router = useRouter();
  
  const formatCurrency = (amount: number) =>
    `USh ${amount.toLocaleString("en-UG", { minimumFractionDigits: 0 })}`;

  const getAccountTypeDisplayName = (name: string) => {
    const displayNames: { [key: string]: string } = {
      VOLUNTARY_SAVINGS: "Voluntary Savings",
      FIXED_DEPOSIT: "Fixed Deposit",
      EMERGENCY_SAVINGS: "Emergency Savings",
    };
    return displayNames[name] || name;
  };

  return (
    <Card className="rounded-xl border-neutral-100 shadow-sm overflow-hidden bg-white h-full">
      <CardHeader className="border-b border-neutral-50 pb-6">
        <CardTitle className="text-lg font-bold flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-indigo-500" />
                Borrower Profile
            </div>
            <Button 
                onClick={() => router.push(`/dashboard/members/${member.id}`)}
                variant="outline" 
                size="sm" 
                className="h-7 text-[10px] uppercase font-black tracking-widest"
            >
                View Full
            </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-indigo-50 border-2 border-indigo-100 flex items-center justify-center overflow-hidden transition-transform hover:scale-105">
            {member.user.image ? (
              <img
                src={member.user.image}
                alt={member.user.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <User className="h-8 w-8 text-indigo-400" />
            )}
          </div>
          <div>
            <h3 className="text-lg font-bold text-neutral-900 leading-tight">
              {member.user.name}
            </h3>
            <div className="flex items-center gap-1.5 mt-1">
              <div className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50/50 px-2 py-0.5 rounded border border-indigo-100 transition-colors hover:bg-indigo-100">
                #{member.memberNumber}
              </div>
              {member.user.phone && (
                <span className="text-xs font-medium text-muted-foreground italic">
                  {member.user.phone}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-3 text-sm group">
            <div className="p-2 rounded-xl bg-neutral-50 text-neutral-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
              <Mail className="h-4 w-4" />
            </div>
            <span className="font-medium text-neutral-600 truncate">
              {member.user.email || "No email available"}
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm group">
            <div className="p-2 rounded-xl bg-neutral-50 text-neutral-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
              <Phone className="h-4 w-4" />
            </div>
            <span className="font-medium text-neutral-600">
              {member.user.phone || "No phone contact"}
            </span>
          </div>
        </div>

        <Separator className="bg-neutral-50" />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">
              Connected Accounts
            </h4>
            <div className="bg-neutral-100 text-neutral-600 text-[8px] px-2 py-0.5 rounded-full font-black uppercase">
              {(member.accounts || []).length} ACTIVE
            </div>
          </div>
          <div className="space-y-3">
            {(member.accounts || []).map((account) => (
              <div
                key={account.id}
                className="p-3 bg-neutral-50 rounded-2xl border border-neutral-100 hover:border-indigo-100 transition-all group"
              >
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-neutral-500 uppercase">
                    {account.accountNumber}
                  </span>
                  <span className="font-black text-neutral-900">
                    {formatCurrency(account.balance)}
                  </span>
                </div>
                <div className="text-[9px] font-bold text-neutral-400 uppercase mt-1 opacity-60 italic">
                  {getAccountTypeDisplayName(account.accountType.name)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
