"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { notFound } from "next/navigation";

export default function MemberOverviewPage() {
  const { id } = useParams<{ id: string }>();
  const [member, setMember] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/v1/members/${id}`)
      .then((r) => r.json())
      .then((json) => {
        setMember(json.data || null);
        setLoading(false);
      });
  }, [id]);

  if (loading) return <div className="p-8 text-center text-slate-500">Loading...</div>;
  if (!member) return notFound();

  const safeDisplay = (value: any, fallback = "N/A") =>
    value !== null && value !== undefined && value !== "" ? value : fallback;

  const formatCurrency = (value: any) => {
    if (value === null || value === undefined || value === "") return "0";
    const numValue = typeof value === "string" ? parseFloat(value) : value;
    return isNaN(numValue) ? "0" : numValue.toLocaleString();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Personal Information</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              ["Full Name", member.user?.name],
              ["Surname", member.surname],
              ["Other Names", member.otherNames],
              ["Age", member.age ? `${member.age} years` : null],
              ["Gender", member.gender],
              ["Marital Status", member.maritalStatus],
              ["Date of Birth", member.user?.dateOfBirth ? new Date(member.user.dateOfBirth).toLocaleDateString() : null],
              ["National ID", member.nin || member.user?.nationalId],
              ["Citizenship", member.citizenship],
            ].map(([label, value]) => (
              <div key={label as string}>
                <label className="text-sm font-medium text-muted-foreground">{label}</label>
                <p className="font-medium">{safeDisplay(value)}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Family Information</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              ["Next of Kin", member.nokName],
              ["Relationship", member.nokRelationship],
              ["NOK Phone", member.nokPhone],
              ["Number of Children", member.numberOfChildren],
              ["Number of Dependants", member.numberOfDependants],
              ["Father's Name", member.fatherName],
              ["Mother's Name", member.motherName],
            ].map(([label, value]) => (
              <div key={label as string}>
                <label className="text-sm font-medium text-muted-foreground">{label}</label>
                <p className="font-medium">{safeDisplay(value)}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Address Information</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              ["Village", member.village],
              ["Parish", member.parish],
              ["Sub County", member.subCounty],
              ["Constituency", member.constituency],
              ["Town", member.town],
              ["District", member.district],
              ["Postal Address", member.postalAddress],
            ].map(([label, value]) => (
              <div key={label as string} className={label === "Postal Address" ? "md:col-span-2" : ""}>
                <label className="text-sm font-medium text-muted-foreground">{label}</label>
                <p className="font-medium">{safeDisplay(value)}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>SACCO Information</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Entry Fee</label>
              <p className="font-medium">UGX {formatCurrency(member.entryFee)}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Initial Savings</label>
              <p className="font-medium">UGX {formatCurrency(member.initialSavings)}</p>
            </div>
            {[
              ["Nominee", member.nominee],
              ["Certified By", member.certifiedBy],
              ["Certifier Account", member.certifierAccountNo],
              ["Savings Account Number", member.savingsAccountNumber],
            ].map(([label, value]) => (
              <div key={label as string}>
                <label className="text-sm font-medium text-muted-foreground">{label}</label>
                <p className="font-medium">{safeDisplay(value)}</p>
              </div>
            ))}
            <div>
              <label className="text-sm font-medium text-muted-foreground">Financial Discipline</label>
              {member.financialDiscipline ? (
                <Badge variant={member.financialDiscipline === "EXCELLENT" ? "default" : "secondary"}>
                  {member.financialDiscipline}
                </Badge>
              ) : <p className="font-medium">N/A</p>}
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Approval Date</label>
              <p className="font-medium">{member.approvalDate ? new Date(member.approvalDate).toLocaleDateString() : "N/A"}</p>
            </div>
          </div>
          <Separator />
          <div>
            <label className="text-sm font-medium text-muted-foreground">Withdrawal Instructions</label>
            <p className="font-medium mt-1">{safeDisplay(member.withdrawalInstructions)}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
