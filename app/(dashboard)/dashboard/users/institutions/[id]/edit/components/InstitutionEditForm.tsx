// app/dashboard/institutions/[id]/edit/components/InstitutionEditForm.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import {
  ArrowLeft,
  Building2,
  User,
  MapPin,
  Landmark,
  FileText,
  Users,
  Save,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Validation Schema
const institutionEditSchema = z.object({
  // Basic Information
  institutionName: z.string().min(2, "Institution name is required"),
  institutionType: z.string().min(1, "Institution type is required"),
  registrationDate: z.string(),
  registrationNumber: z.string().optional(),
  tinNumber: z.string().optional(),
  yearEstablished: z.string().optional(),
  legalStatus: z.string().optional(),
  businessSector: z.string().optional(),
  numberOfEmployees: z.string().optional(),

  // Contact Information
  primaryContactPerson: z.string().min(2, "Primary contact person is required"),
  primaryContactTitle: z.string().optional(),
  primaryContactPhone: z.string().min(10, "Primary contact phone is required"),
  primaryContactEmail: z
    .string()
    .email("Invalid email")
    .optional()
    .or(z.literal("")),
  institutionPhone: z.string().min(10, "Institution phone is required"),
  institutionEmail: z.string().email("Invalid email"),

  // Physical Address
  plotNumber: z.string().optional(),
  street: z.string().optional(),
  village: z.string().optional(),
  parish: z.string().optional(),
  subCounty: z.string().optional(),
  constituency: z.string().optional(),
  town: z.string().optional(),
  district: z.string().optional(),
  postalAddress: z.string().optional(),

  // Banking Information
  bankName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  accountTitle: z.string().optional(),
  accountType: z.string().optional(),

  // Financial Information
  entryFee: z.string().optional(),
  initialDeposit: z.string().optional(),

  // Objectives and Activities
  majorObjective: z.string().optional(),
  majorActivities: z.string().optional(),
  founderNames: z.string().optional(),
  operatingInstructions: z.string().optional(),
  signatoryChangeRules: z.string().optional(),

  // Administrators (JSON array)
  administrators: z.string().optional(),

  // Branch
  branchId: z.string().min(1, "Branch is required"),
});

type InstitutionEditFormValues = z.infer<typeof institutionEditSchema>;

interface Administrator {
  name: string;
  post: string;
  phone: string;
}

interface InstitutionEditFormProps {
  institution: any;
  branches: any[];
  currentUser: any;
}

export default function InstitutionEditForm({
  institution,
  branches,
  currentUser,
}: InstitutionEditFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState("basic");

  // Parse administrators
  const administrators: Administrator[] = Array.isArray(
    institution.administrators
  )
    ? institution.administrators
    : [];

  const form = useForm<InstitutionEditFormValues>({
    resolver: zodResolver(institutionEditSchema),
    defaultValues: {
      institutionName: institution.institutionName,
      institutionType: institution.institutionType,
      registrationDate: institution.registrationDate
        ? new Date(institution.registrationDate).toISOString().split("T")[0]
        : "",
      registrationNumber: institution.registrationNumber || "",
      tinNumber: institution.tinNumber || "",
      yearEstablished: institution.yearEstablished?.toString() || "",
      legalStatus: institution.legalStatus || "",
      businessSector: institution.businessSector || "",
      numberOfEmployees: institution.numberOfEmployees?.toString() || "",

      primaryContactPerson: institution.primaryContactPerson,
      primaryContactTitle: institution.primaryContactTitle || "",
      primaryContactPhone: institution.primaryContactPhone,
      primaryContactEmail: institution.primaryContactEmail || "",
      institutionPhone: institution.institutionPhone,
      institutionEmail: institution.institutionEmail,

      plotNumber: institution.plotNumber || "",
      street: institution.street || "",
      village: institution.village || "",
      parish: institution.parish || "",
      subCounty: institution.subCounty || "",
      constituency: institution.constituency || "",
      town: institution.town || "",
      district: institution.district || "",
      postalAddress: institution.postalAddress || "",

      bankName: institution.bankName || "",
      bankAccountNumber: institution.bankAccountNumber || "",
      accountTitle: institution.accountTitle || "",
      accountType: institution.accountType || "",

      entryFee: institution.entryFee?.toString() || "",
      initialDeposit: institution.initialDeposit?.toString() || "",

      majorObjective: institution.majorObjective || "",
      majorActivities: institution.majorActivities || "",
      founderNames: institution.founderNames || "",
      operatingInstructions: institution.operatingInstructions || "",
      signatoryChangeRules: institution.signatoryChangeRules || "",

      administrators: JSON.stringify(administrators, null, 2),

      branchId: institution.user.branchId,
    },
  });

  async function onSubmit(values: InstitutionEditFormValues) {
    startTransition(async () => {
      try {
        // Parse administrators
        let parsedAdministrators: Administrator[] = [];
        if (values.administrators) {
          try {
            parsedAdministrators = JSON.parse(values.administrators);
          } catch (e) {
            toast.error("Invalid administrators JSON format");
            return;
          }
        }

        // Prepare data for submission
        const submitData = {
          ...values,
          yearEstablished: values.yearEstablished
            ? parseInt(values.yearEstablished)
            : undefined,
          numberOfEmployees: values.numberOfEmployees
            ? parseInt(values.numberOfEmployees)
            : undefined,
          entryFee: values.entryFee ? parseFloat(values.entryFee) : undefined,
          initialDeposit: values.initialDeposit
            ? parseFloat(values.initialDeposit)
            : undefined,
          administrators: parsedAdministrators,
        };

        const apiRes = await fetch(`/api/v1/institutions/${institution.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(submitData),
        });
        const res = await apiRes.json();

        if (!apiRes.ok) {
          toast.error(res.error || "Failed to update institution");
        } else {
          toast.success("Institution updated successfully");
          router.push(`/dashboard/users/institution/${institution.id}`);
          router.refresh();
        }
      } catch (error) {
        toast.error("An error occurred while updating the institution");
      }
    });
  }

  return (
    <div className="flex h-full flex-1 flex-col gap-6 rounded-xl bg-background p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/dashboard/institutions/${institution.id}`}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Edit Institution</h1>
                <p className="text-sm text-muted-foreground">
                  {institution.institutionName}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="contact">Contact</TabsTrigger>
              <TabsTrigger value="address">Address</TabsTrigger>
              <TabsTrigger value="banking">Banking</TabsTrigger>
              <TabsTrigger value="other">Other</TabsTrigger>
            </TabsList>

            {/* Basic Information Tab */}
            <TabsContent value="basic" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Basic Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="institutionName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Institution Name *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter institution name"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="institutionType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Institution Type *</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="SACCO">SACCO</SelectItem>
                              <SelectItem value="COOPERATIVE">
                                COOPERATIVE
                              </SelectItem>
                              <SelectItem value="ASSOCIATION">
                                ASSOCIATION
                              </SelectItem>
                              <SelectItem value="COMPANY">COMPANY</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="registrationDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Registration Date *</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="registrationNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Registration Number</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter registration number"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="tinNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>TIN Number</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter TIN number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <FormField
                      control={form.control}
                      name="yearEstablished"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Year Established</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="2020"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="legalStatus"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Legal Status</FormLabel>
                          <FormControl>
                            <Input placeholder="Registered" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="businessSector"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Business Sector</FormLabel>
                          <FormControl>
                            <Input placeholder="Agriculture" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="numberOfEmployees"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Number of Employees</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="10" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="branchId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Branch *</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select branch" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {branches.map((branch) => (
                                <SelectItem key={branch.id} value={branch.id}>
                                  {branch.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Contact Information Tab */}
            <TabsContent value="contact" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Primary Contact Person
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="primaryContactPerson"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="John Doe" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="primaryContactTitle"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Title/Position</FormLabel>
                          <FormControl>
                            <Input placeholder="Director" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="primaryContactPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number *</FormLabel>
                          <FormControl>
                            <Input placeholder="0700000000" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="primaryContactEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Address</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="contact@example.com"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Institution Contact
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="institutionPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number *</FormLabel>
                          <FormControl>
                            <Input placeholder="0700000000" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="institutionEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Address *</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="info@example.com"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Address Tab */}
            <TabsContent value="address" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Physical Address
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <FormField
                      control={form.control}
                      name="plotNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Plot Number</FormLabel>
                          <FormControl>
                            <Input placeholder="Plot 123" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="street"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Street</FormLabel>
                          <FormControl>
                            <Input placeholder="Main Street" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="village"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Village</FormLabel>
                          <FormControl>
                            <Input placeholder="Village name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <FormField
                      control={form.control}
                      name="parish"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Parish</FormLabel>
                          <FormControl>
                            <Input placeholder="Parish name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="subCounty"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sub County</FormLabel>
                          <FormControl>
                            <Input placeholder="Sub County" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="constituency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Constituency</FormLabel>
                          <FormControl>
                            <Input placeholder="Constituency" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <FormField
                      control={form.control}
                      name="town"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Town</FormLabel>
                          <FormControl>
                            <Input placeholder="Town name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="district"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>District</FormLabel>
                          <FormControl>
                            <Input placeholder="District name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="postalAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Postal Address</FormLabel>
                          <FormControl>
                            <Input placeholder="P.O. Box 123" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Banking Tab */}
            <TabsContent value="banking" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Landmark className="h-5 w-5" />
                    Banking Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="bankName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bank Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Bank of Uganda" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="bankAccountNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bank Account Number</FormLabel>
                          <FormControl>
                            <Input placeholder="1234567890" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="accountTitle"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Account Title</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Institution Account"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="accountType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Account Type</FormLabel>
                          <FormControl>
                            <Input placeholder="Current Account" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="entryFee"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Entry Fee (UGX)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="50000"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="initialDeposit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Initial Deposit (UGX)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="100000"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Other Information Tab */}
            <TabsContent value="other" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Objectives & Activities
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="majorObjective"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Major Objective</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Describe the major objective..."
                            rows={4}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="majorActivities"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Major Activities</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Describe the major activities..."
                            rows={4}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="founderNames"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Founders</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="List the founders..."
                            rows={3}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Operating Rules
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="operatingInstructions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Operating Instructions</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Describe operating instructions..."
                            rows={4}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="signatoryChangeRules"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Signatory Change Rules</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Describe signatory change rules..."
                            rows={4}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Administrators
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="administrators"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Administrators (JSON Format)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder='[{"name":"John Doe","post":"Director","phone":"0700000000"}]'
                            rows={10}
                            className="font-mono text-sm"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Enter administrators in JSON format. Each
                          administrator should have: name, post, and phone.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Form Actions */}
          <div className="mt-6 flex items-center justify-between border-t pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} className="gap-2">
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
