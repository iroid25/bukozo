// @ts-nocheck
// app/dashboard/institutions/[id]/components/InstitutionDetailsView.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Building2,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Mail,
  Phone,
  MapPin,
  Calendar,
  User,
  Briefcase,
  CreditCard,
  FileText,
  Users,
  DollarSign,
  ShieldCheck,
  Edit,
  Ban,
  Building,
  Hash,
  Landmark,
  AlertCircle,
  Download,
  Printer,
} from "lucide-react";
import { UserRole } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmationDialog } from "@/components/ui/data-table";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Administrator {
  name: string;
  post: string;
  phone: string;
  email?: string;
  photo?: string;
  signature?: string;
}

interface InstitutionDetailsProps {
  institution: any;
  currentUser: any;
}

export default function InstitutionDetailsView({
  institution,
  currentUser,
}: InstitutionDetailsProps) {
  const router = useRouter();
  const [isApproving, setIsApproving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const canEdit =
    currentUser?.role &&
    [UserRole.ADMIN, UserRole.BRANCHMANAGER, UserRole.ACCOUNTANT].includes(
      currentUser.role
    );
  const canApprove =
    currentUser?.role &&
    [UserRole.ADMIN, UserRole.BRANCHMANAGER].includes(currentUser.role);
  const canDelete = currentUser?.role === UserRole.ADMIN;

  const administrators: Administrator[] = Array.isArray(
    institution.administrators
  )
    ? institution.administrators
    : [];

  const hasSignedDirector = administrators.some(
    (admin) => !!admin.signature?.trim(),
  );
  const hasRequiredContacts =
    !!institution.primaryContactPerson?.trim() &&
    !!institution.primaryContactPhone?.trim() &&
    !!institution.institutionPhone?.trim();
  const profileReady =
    institution.isApproved &&
    institution.user.isActive &&
    hasRequiredContacts &&
    hasSignedDirector;

  async function handleApprove() {
    try {
      setIsApproving(true);
      const response = await fetch(`/api/v1/institutions/${institution.id}/approve`, {
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to approve institution");
      }

      toast.success("Institution approved successfully");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to approve institution");
    } finally {
      setIsApproving(false);
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    const res = await fetch(`/api/v1/institutions/${institution.id}`, { method: "DELETE" });
    const json = await res.json();
    setIsDeleting(false);

    if (!res.ok) {
      toast.error(json.error || "Failed to disable institution");
    } else {
      toast.success("Institution disabled successfully");
      setDeleteDialogOpen(false);
      router.push("/dashboard/users/institutions");
    }
  }

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex h-full flex-1 flex-col gap-6 rounded-xl bg-background p-6">
      {/* Header Section */}
      <div className="space-y-6">
        {/* Navigation & Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/dashboard/users/institutions">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Institution Details
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Complete information about the institution
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            {!institution.isApproved && canApprove && (
              <Button
                onClick={handleApprove}
                disabled={isApproving}
                size="sm"
                className="gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                {isApproving ? "Approving..." : "Approve"}
              </Button>
            )}
            {canEdit && (
              <Button variant="outline" size="sm" className="gap-2" asChild>
                <Link
                  href={`/dashboard/users/institutions/${institution.id}/edit`}
                >
                  <Edit className="h-4 w-4" />
                  Edit
                </Link>
              </Button>
            )}
            {canDelete && (
              <Button
                variant="destructive"
                size="sm"
                className="gap-2"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Ban className="h-4 w-4" />
                Disable
              </Button>
            )}
          </div>
        </div>

        {/* Institution Header Card */}
        <Card className="border-2">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-lg">
                <Building2 className="h-8 w-8" />
              </div>

              <div className="flex-1 space-y-3">
                <div>
                  <h2 className="text-2xl font-bold">
                    {institution.institutionName}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <Badge variant="secondary" className="font-mono">
                      #{institution.institutionNumber}
                    </Badge>
                    <Badge variant="outline">
                      {institution.institutionType}
                    </Badge>
                    {institution.user.branch?.name && (
                      <Badge variant="outline" className="gap-1">
                        <Building className="h-3 w-3" />
                        {institution.user.branch.name}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {institution.isApproved ? (
                    <Badge className="gap-1" variant="default">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Approved
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-1">
                      <AlertCircle className="h-3.5 w-3.5" />
                      Pending Approval
                    </Badge>
                  )}
                  <Badge
                    variant={
                      institution.user.isActive ? "default" : "destructive"
                    }
                  >
                    {institution.user.isActive ? "Active" : "Disabled"}
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <Calendar className="h-3 w-3" />
                    Registered{" "}
                    {format(
                      new Date(institution.registrationDate),
                      "MMM d, yyyy"
                    )}
                  </Badge>
                  <Badge variant={profileReady ? "default" : "outline"}>
                    {profileReady ? "Profile ready" : "Profile incomplete"}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pending Approval Alert */}
        {!institution.isApproved && canApprove && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This institution is pending approval. Review all details and click
              "Approve" to activate the account.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="flex-1">
        <TabsList className="w-full justify-start h-auto flex-wrap gap-1">
          <TabsTrigger value="overview" className="gap-2">
            <Building2 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="background" className="gap-2">
            <FileText className="h-4 w-4" />
            Background
          </TabsTrigger>
          <TabsTrigger value="contact" className="gap-2">
            <User className="h-4 w-4" />
            Contact
          </TabsTrigger>
          <TabsTrigger value="location" className="gap-2">
            <MapPin className="h-4 w-4" />
            Location
          </TabsTrigger>
          <TabsTrigger value="banking" className="gap-2">
            <Landmark className="h-4 w-4" />
            Banking
          </TabsTrigger>
          <TabsTrigger value="administrators" className="gap-2">
            <Users className="h-4 w-4" />
            Administrators ({administrators.length})
          </TabsTrigger>
          <TabsTrigger value="financial" className="gap-2">
            <DollarSign className="h-4 w-4" />
            Financial
          </TabsTrigger>
          <TabsTrigger value="accounts" className="gap-2">
            <CreditCard className="h-4 w-4" />
            Accounts
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Basic Information */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                    <Building2 className="h-4 w-4" />
                  </div>
                  Basic Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <InfoItem
                  label="Institution Number"
                  value={institution.institutionNumber}
                  icon={<Hash className="h-4 w-4" />}
                />
                <InfoItem
                  label="Institution Type"
                  value={institution.institutionType}
                />
                <InfoItem
                  label="Registration Date"
                  value={format(
                    new Date(institution.registrationDate),
                    "MMMM d, yyyy"
                  )}
                  icon={<Calendar className="h-4 w-4" />}
                />
                {institution.yearEstablished && (
                  <InfoItem
                    label="Year Established"
                    value={institution.yearEstablished.toString()}
                  />
                )}
              </CardContent>
            </Card>

            {/* Registration Details */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <div className="p-2 rounded-lg bg-purple-100 text-purple-700">
                    <FileText className="h-4 w-4" />
                  </div>
                  Registration Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <InfoItem
                  label="Registration Number"
                  value={institution.registrationNumber || "Not provided"}
                />
                <InfoItem
                  label="TIN Number"
                  value={institution.tinNumber || "Not provided"}
                />
                <InfoItem
                  label="Legal Status"
                  value={institution.legalStatus || "Not specified"}
                />
              </CardContent>
            </Card>

            {/* Business Information */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <div className="p-2 rounded-lg bg-green-100 text-green-700">
                    <Briefcase className="h-4 w-4" />
                  </div>
                  Business Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <InfoItem
                  label="Business Sector"
                  value={institution.businessSector || "Not specified"}
                />
                <InfoItem
                  label="Number of Employees"
                  value={
                    institution.numberOfEmployees?.toString() || "Not specified"
                  }
                />
              </CardContent>
            </Card>

            {/* Branch Information */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <div className="p-2 rounded-lg bg-orange-100 text-orange-700">
                    <Building className="h-4 w-4" />
                  </div>
                  Branch Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <InfoItem
                  label="Branch Name"
                  value={institution.user.branch?.name || "No branch assigned"}
                />
                <InfoItem
                  label="Account Status"
                  value={institution.user.isActive ? "Active" : "Disabled"}
                  badge={
                    <Badge
                      variant={
                        institution.user.isActive ? "default" : "destructive"
                      }
                      className="ml-2"
                    >
                      {institution.user.isActive ? "Active" : "Disabled"}
                    </Badge>
                  }
                />
              </CardContent>
            </Card>

            {/* Approval Status */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  Approval Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <InfoItem
                  label="Status"
                  value={institution.isApproved ? "Approved" : "Pending"}
                  badge={
                    <Badge
                      variant={institution.isApproved ? "default" : "secondary"}
                      className="ml-2"
                    >
                      {institution.isApproved ? "Approved" : "Pending"}
                    </Badge>
                  }
                />
                {institution.isApproved && institution.approvalDate && (
                  <InfoItem
                    label="Approval Date"
                    value={format(
                      new Date(institution.approvalDate),
                      "MMMM d, yyyy"
                    )}
                    icon={<Calendar className="h-4 w-4" />}
                  />
                )}
              </CardContent>
            </Card>

            {/* Contact Summary */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <div className="p-2 rounded-lg bg-cyan-100 text-cyan-700">
                    <Phone className="h-4 w-4" />
                  </div>
                  Quick Contact
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <InfoItem
                  label="Institution Phone"
                  value={institution.institutionPhone}
                  icon={<Phone className="h-4 w-4" />}
                />
                <InfoItem
                  label="Institution Email"
                  value={institution.institutionEmail}
                  icon={<Mail className="h-4 w-4" />}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Background Tab */}
        <TabsContent value="background" className="space-y-6 mt-6">
          <div className="grid gap-6">
            {/* Founders */}
            {institution.founders && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-blue-600" />
                    Founder(s)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed">
                    {institution.founders}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Foundation Date */}
            {institution.foundedDate && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-purple-600" />
                    Foundation Date
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">
                    {format(new Date(institution.foundedDate), "MMMM d, yyyy")}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Major Objective */}
            {institution.majorObjective && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-green-600" />
                    Major Objective
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {institution.majorObjective}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Major Activities */}
            {institution.majorActivities && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Briefcase className="h-5 w-5 text-orange-600" />
                    Major Activities
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {institution.majorActivities}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Contact Tab */}
        <TabsContent value="contact" className="space-y-6 mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Primary Contact Person */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                    <User className="h-4 w-4" />
                  </div>
                  Primary Contact Person
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <InfoItem
                  label="Name"
                  value={institution.primaryContactPerson}
                />
                {institution.primaryContactTitle && (
                  <InfoItem
                    label="Title/Position"
                    value={institution.primaryContactTitle}
                  />
                )}
                <Separator />
                <InfoItem
                  label="Phone Number"
                  value={institution.primaryContactPhone}
                  icon={<Phone className="h-4 w-4" />}
                />
                {institution.primaryContactEmail && (
                  <InfoItem
                    label="Email Address"
                    value={institution.primaryContactEmail}
                    icon={<Mail className="h-4 w-4" />}
                  />
                )}
              </CardContent>
            </Card>

            {/* Institution Contact */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-green-100 text-green-700">
                    <Building2 className="h-4 w-4" />
                  </div>
                  Institution Contact Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <InfoItem
                  label="Institution Phone"
                  value={institution.institutionPhone}
                  icon={<Phone className="h-4 w-4" />}
                />
                <InfoItem
                  label="Institution Email"
                  value={institution.institutionEmail}
                  icon={<Mail className="h-4 w-4" />}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Location Tab */}
        <TabsContent value="location" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-red-100 text-red-700">
                  <MapPin className="h-5 w-5" />
                </div>
                Physical Address & Location
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {institution.plotNumber && (
                  <InfoItem
                    label="Plot Number"
                    value={institution.plotNumber}
                  />
                )}
                {institution.street && (
                  <InfoItem label="Street" value={institution.street} />
                )}
                {institution.village && (
                  <InfoItem label="Village" value={institution.village} />
                )}
                {institution.parish && (
                  <InfoItem label="Parish" value={institution.parish} />
                )}
                {institution.subCounty && (
                  <InfoItem label="Sub County" value={institution.subCounty} />
                )}
                {institution.constituency && (
                  <InfoItem
                    label="Constituency"
                    value={institution.constituency}
                  />
                )}
                {institution.town && (
                  <InfoItem label="Town/City" value={institution.town} />
                )}
                {institution.district && (
                  <InfoItem label="District" value={institution.district} />
                )}
                {institution.postalAddress && (
                  <InfoItem
                    label="Postal Address"
                    value={institution.postalAddress}
                    className="md:col-span-2 lg:col-span-3"
                  />
                )}
              </div>

              {!institution.plotNumber &&
                !institution.street &&
                !institution.village && (
                  <p className="text-center text-sm text-muted-foreground py-8">
                    No location information provided
                  </p>
                )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Banking Tab */}
        <TabsContent value="banking" className="space-y-6 mt-6">
          <div className="grid gap-6">
            {/* Bank Details */}
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                      <Landmark className="h-4 w-4" />
                    </div>
                    Bank Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <InfoItem
                    label="Bank Name"
                    value={institution.bankName || "Not provided"}
                  />
                  <InfoItem
                    label="Bank Account Number"
                    value={institution.bankAccountNumber || "Not provided"}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-purple-100 text-purple-700">
                      <CreditCard className="h-4 w-4" />
                    </div>
                    Account Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <InfoItem
                    label="Account Title"
                    value={institution.accountTitle || "Not provided"}
                  />
                  <InfoItem
                    label="Account Type"
                    value={institution.accountType || "Not specified"}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Operating Instructions */}
            {institution.operatingInstructions && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-green-600" />
                    Operating Instructions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {institution.operatingInstructions}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Signatory Change Rules */}
            {institution.signatoryChangeRules && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-orange-600" />
                    Signatory Change Rules
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {institution.signatoryChangeRules}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Administrators Tab */}
        <TabsContent value="administrators" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                  <Users className="h-5 w-5" />
                </div>
                Institution Administrators
                <Badge variant="secondary" className="ml-2">
                  {administrators.length} Total
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {administrators.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2">
                  {administrators.map((admin, index) => (
                    <Card key={index} className="border-2">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            {admin.photo ? (
                              <img
                                src={admin.photo}
                                alt={admin.name}
                                className="h-12 w-12 rounded-full object-cover border-2"
                              />
                            ) : (
                              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-white font-semibold">
                                {admin.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <h4 className="font-semibold">{admin.name}</h4>
                              <p className="text-sm text-muted-foreground">
                                {admin.post}
                              </p>
                            </div>
                          </div>
                          <Badge variant="outline">Admin {index + 1}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <Separator />
                        <InfoItem
                          label="Phone Number"
                          value={admin.phone}
                          icon={<Phone className="h-4 w-4" />}
                        />
                        {admin.email && (
                          <InfoItem
                            label="Email Address"
                            value={admin.email}
                            icon={<Mail className="h-4 w-4" />}
                          />
                        )}
                        {admin.signature && (
                          <div className="pt-2">
                            <span className="text-xs font-medium text-muted-foreground">
                              Signature
                            </span>
                            <div className="mt-2 p-4 border rounded-lg bg-muted/30">
                              <img
                                src={admin.signature}
                                alt={`${admin.name} signature`}
                                className="h-16 w-auto mx-auto object-contain"
                              />
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-sm text-muted-foreground">
                    No administrators registered
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Financial Tab */}
        <TabsContent value="financial" className="space-y-6 mt-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Entry Fee */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className="p-2 rounded-lg bg-green-100 text-green-700">
                    <DollarSign className="h-4 w-4" />
                  </div>
                  Entry Fee
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  UGX {institution.entryFee?.toLocaleString() || "0"}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  One-time registration fee
                </p>
              </CardContent>
            </Card>

            {/* Initial Deposit */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                    <DollarSign className="h-4 w-4" />
                  </div>
                  Initial Deposit
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">
                  UGX {institution.initialDeposit?.toLocaleString() || "0"}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Opening deposit amount
                </p>
              </CardContent>
            </Card>

            {/* Share Capital */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className="p-2 rounded-lg bg-purple-100 text-purple-700">
                    <DollarSign className="h-4 w-4" />
                  </div>
                  Share Capital
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-600">
                  UGX {institution.shareCapital?.toLocaleString() || "0"}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Total share capital contribution
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Accounts Tab */}
        <TabsContent value="accounts" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-green-100 text-green-700">
                  <CreditCard className="h-5 w-5" />
                </div>
                Account Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <InfoItem
                  label="Username"
                  value={institution.user.username}
                  icon={<User className="h-4 w-4" />}
                />
                <InfoItem
                  label="Account Created"
                  value={format(
                    new Date(institution.user.createdAt),
                    "MMMM d, yyyy 'at' h:mm a"
                  )}
                  icon={<Calendar className="h-4 w-4" />}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-full ${institution.user.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                  >
                    {institution.user.isActive ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <XCircle className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">Account Status</p>
                    <p className="text-sm text-muted-foreground">
                      This account is currently{" "}
                      {institution.user.isActive ? "active" : "disabled"}
                    </p>
                  </div>
                </div>
                <Badge
                  variant={
                    institution.user.isActive ? "default" : "destructive"
                  }
                >
                  {institution.user.isActive ? "Active" : "Disabled"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        title="Disable Institution"
        description={`Are you sure you want to disable "${institution.institutionName}"? This action will deactivate the institution's account.`}
        confirmText={isDeleting ? "Disabling..." : "Disable"}
        cancelText="Cancel"
        variant="destructive"
        disabled={isDeleting}
      />
    </div>
  );
}

// Helper Component for Info Items
function InfoItem({
  label,
  value,
  icon,
  badge,
  className,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="flex items-center gap-1.5 mb-1">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium break-words">{value}</p>
        {badge}
      </div>
    </div>
  );
}
