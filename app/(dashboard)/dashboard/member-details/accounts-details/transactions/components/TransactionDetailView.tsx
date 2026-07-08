import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import Link from "next/link";
import { ArrowLeft, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  transaction: any;
  currentUser: any;
  action?: string;
}

function statusColor(status: string) {
  if (status === "COMPLETED") return "default";
  if (status === "PENDING") return "secondary";
  if (status === "FAILED" || status === "REVERSED") return "destructive";
  return "outline";
}

function formatAmount(amount: number) {
  return `UGX ${Number(amount ?? 0).toLocaleString("en-UG", { maximumFractionDigits: 0 })}`;
}

export default function TransactionDetailView({ transaction, currentUser, action }: Props) {
  const member = transaction.member?.user;
  const institution = transaction.institution;
  const account = transaction.account;
  const processedBy = transaction.processedByUser;

  const holderName = member
    ? member.name || `${member.firstName ?? ""} ${member.lastName ?? ""}`.trim()
    : institution?.institutionName ?? "—";

  const transactionDate = transaction.createdAt
    ? format(new Date(transaction.createdAt), "dd MMM yyyy, HH:mm")
    : "—";

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/member-details">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Receipt className="h-6 w-6" />
              Transaction Detail
            </h1>
            <p className="text-sm text-muted-foreground">Ref: {transaction.reference ?? transaction.id}</p>
          </div>
        </div>
        <Badge variant={statusColor(transaction.status)}>{transaction.status}</Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Transaction Info</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Row label="Type" value={transaction.type} />
            <Row label="Amount" value={formatAmount(transaction.amount)} />
            <Row label="Status" value={transaction.status} />
            <Row label="Date" value={transactionDate} />
            <Row label="Description" value={transaction.description ?? "—"} />
            {transaction.notes && <Row label="Notes" value={transaction.notes} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Account Holder</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Row label="Name" value={holderName} />
            {member && <Row label="Email" value={member.email ?? "—"} />}
            {member && <Row label="Phone" value={member.phone ?? "—"} />}
            {institution && <Row label="Type" value={institution.institutionType ?? "—"} />}
            {account && <Row label="Account No." value={account.accountNumber} />}
            {account && <Row label="Account Type" value={account.accountType?.name ?? "—"} />}
            {account && <Row label="Branch" value={account.branch?.name ?? "—"} />}
          </CardContent>
        </Card>

        {processedBy && (
          <Card>
            <CardHeader><CardTitle className="text-base">Processed By</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Row label="Name" value={processedBy.name ?? `${processedBy.firstName ?? ""} ${processedBy.lastName ?? ""}`.trim()} />
              <Row label="Role" value={processedBy.role ?? "—"} />
            </CardContent>
          </Card>
        )}

        {(transaction.balanceBefore != null || transaction.balanceAfter != null) && (
          <Card>
            <CardHeader><CardTitle className="text-base">Balance Impact</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {transaction.balanceBefore != null && <Row label="Balance Before" value={formatAmount(transaction.balanceBefore)} />}
              {transaction.balanceAfter != null && <Row label="Balance After" value={formatAmount(transaction.balanceAfter)} />}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-sm text-muted-foreground flex-shrink-0">{label}</span>
      <span className="text-sm font-medium text-right">{value}</span>
    </div>
  );
}
