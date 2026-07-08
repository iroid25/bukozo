"use client";

import { User, Branch } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mail, Phone, MapPin, Calendar, Building } from "lucide-react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";

import type { AuthUser } from "@/config/useAuth";

interface LoanOfficerDetailsViewProps {
  loanOfficer: User & { branch: Branch | null };
  currentUser: AuthUser | null;
  branches: Branch[];
}

export default function LoanOfficerDetailsView({
  loanOfficer,
  currentUser,
  branches,
}: LoanOfficerDetailsViewProps) {
  const router = useRouter();

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{loanOfficer.name}</h1>
            <p className="text-muted-foreground">Loan Officer Details</p>
          </div>
        </div>
        <Badge variant={loanOfficer.isActive ? "default" : "secondary"}>
          {loanOfficer.isActive ? "Active" : "Inactive"}
        </Badge>
      </div>

      {/* Details Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Personal Information */}
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{loanOfficer.email}</p>
              </div>
            </div>
            {loanOfficer.phone && (
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{loanOfficer.phone}</p>
                </div>
              </div>
            )}
            {loanOfficer.address && (
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Address</p>
                  <p className="font-medium">{loanOfficer.address}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Work Information */}
        <Card>
          <CardHeader>
            <CardTitle>Work Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loanOfficer.branch && (
              <div className="flex items-center gap-3">
                <Building className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Branch</p>
                  <p className="font-medium">{loanOfficer.branch.name}</p>
                </div>
              </div>
            )}
            {loanOfficer.jobTitle && (
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">Job Title</p>
                  <p className="font-medium">{loanOfficer.jobTitle}</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Joined</p>
                <p className="font-medium">
                  {format(new Date(loanOfficer.createdAt), "PPP")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
