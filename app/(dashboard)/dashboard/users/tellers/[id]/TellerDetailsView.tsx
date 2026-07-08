// @ts-nocheck
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Building,
  Shield,
  Edit,
  Settings,
  Activity,
  Clock,
} from "lucide-react";
import { formatISODate } from "@/lib/utils";
import { UserRole } from "@prisma/client";
import { toast } from "sonner";

interface TellerDetailsViewProps {
  teller: {
    id: string;
    name: string;
    firstName?: string | null;
    lastName?: string | null;
    email: string | null;
    phone?: string | null;
    image?: string | null;
    role: UserRole;
    isActive: boolean;
    isVerified?: boolean | null;
    areaOfOperation?: string | null;
    jobTitle?: string | null;
    createdAt: Date;
    updatedAt?: Date;
    branchId?: string | null;
  };
  currentUser: {
    id: string;
    role: string;
    branchId?: string | null;
  } | null;
  branches: Array<{
    id: string;
    name: string;
    location: string;
  }>;
}

export default function TellerDetailsView({
  teller,
  currentUser,
  branches,
}: TellerDetailsViewProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  // Get teller's branch info
  const tellerBranch = branches.find((branch) => branch.id === teller.branchId);

  // Check if current user can edit this teller
  const canEdit =
    currentUser &&
    (currentUser.role === "ADMIN" ||
      currentUser.role === "MANAGER" ||
      currentUser.id === teller.id);

  const handleEdit = () => {
    router.push(`/dashboard/tellers/${teller.id}/edit`);
  };

  const handleBack = () => {
    router.back();
  };

  // Get initials for avatar fallback
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase())
      .slice(0, 2)
      .join("");
  };

  // Format role display
  const getRoleDisplay = (role: UserRole) => {
    const roleMap = {
      TELLER: "Teller",
      MANAGER: "Manager",
      ADMIN: "Administrator",
      AGENT: "Agent",
      MEMBER: "Member",
    };
    return roleMap[role] || role;
  };

  // Get role badge color
  const getRoleBadgeColor = (role: UserRole) => {
    const colorMap = {
      ADMIN: "bg-red-100 text-red-800",
      MANAGER: "bg-blue-100 text-blue-800",
      TELLER: "bg-green-100 text-green-800",
      AGENT: "bg-purple-100 text-purple-800",
      MEMBER: "bg-gray-100 text-gray-800",
    };
    return colorMap[role] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Teller Details</h1>
            <p className="text-gray-600">View and manage teller information</p>
          </div>
        </div>
        {canEdit && (
          <Button onClick={handleEdit} className="gap-2">
            <Edit className="h-4 w-4" />
            Edit Profile
          </Button>
        )}
      </div>

      <div className="grid gap-6">
        {/* Profile Overview */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-6">
              <Avatar className="h-24 w-24">
                <AvatarImage
                  src={teller.image || "/avatar.avif"}
                  alt={teller.name}
                />
                <AvatarFallback className="text-lg">
                  {getInitials(teller.name)}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-bold">{teller.name}</h2>
                    <p className="text-gray-600 text-lg">
                      {teller.jobTitle || getRoleDisplay(teller.role)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Badge
                      className={getRoleBadgeColor(teller.role)}
                      variant="secondary"
                    >
                      {getRoleDisplay(teller.role)}
                    </Badge>
                    <Badge
                      variant={teller.isActive ? "default" : "destructive"}
                    >
                      {teller.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Mail className="h-4 w-4" />
                    <span>{teller.email || "N/A"}</span>
                  </div>
                  {teller.phone && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Phone className="h-4 w-4" />
                      <span>{teller.phone}</span>
                    </div>
                  )}
                  {tellerBranch && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Building className="h-4 w-4" />
                      <span>{tellerBranch.name}</span>
                    </div>
                  )}
                  {teller.areaOfOperation && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <MapPin className="h-4 w-4" />
                      <span>{teller.areaOfOperation}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Account Information */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-blue-600" />
                Account Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">User ID:</span>
                  <span className="font-mono text-sm">{teller.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Email Verified:</span>
                  <Badge
                    variant={teller.isVerified ? "default" : "secondary"}
                    className={
                      teller.isVerified
                        ? "bg-green-100 text-green-800"
                        : "bg-yellow-100 text-yellow-800"
                    }
                  >
                    {teller.isVerified ? "Verified" : "Unverified"}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Account Status:</span>
                  <Badge variant={teller.isActive ? "default" : "destructive"}>
                    {teller.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Role:</span>
                  <Badge
                    className={getRoleBadgeColor(teller.role)}
                    variant="secondary"
                  >
                    {getRoleDisplay(teller.role)}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5 text-green-600" />
                Work Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {tellerBranch ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Branch:</span>
                      <span className="font-medium">{tellerBranch.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Location:</span>
                      <span className="font-medium">
                        {tellerBranch.location}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Branch:</span>
                    <span className="text-gray-400">Not assigned</span>
                  </div>
                )}

                {teller.jobTitle && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Job Title:</span>
                    <span className="font-medium">{teller.jobTitle}</span>
                  </div>
                )}

                {teller.areaOfOperation && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Area of Operation:</span>
                    <span className="font-medium">
                      {teller.areaOfOperation}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Activity Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-purple-600" />
              Account Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-3 bg-blue-50 rounded-lg">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                  <Calendar className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-blue-900">Account Created</p>
                  <p className="text-sm text-blue-700">
                    {formatISODate(teller.createdAt)}
                  </p>
                </div>
              </div>

              {teller.updatedAt && (
                <div className="flex items-center gap-4 p-3 bg-green-50 rounded-lg">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-600">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-green-900">Last Updated</p>
                    <p className="text-sm text-green-700">
                      {formatISODate(teller.updatedAt)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        {canEdit && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-gray-600" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3 flex-wrap">
                <Button
                  variant="outline"
                  onClick={handleEdit}
                  className="gap-2"
                >
                  <Edit className="h-4 w-4" />
                  Edit Profile
                </Button>

                <Button
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(teller.email || "");
                    toast.success("Email copied to clipboard");
                  }}
                  className="gap-2"
                >
                  <Mail className="h-4 w-4" />
                  Copy Email
                </Button>

                {teller.phone && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(teller.phone || "");
                      toast.success("Phone number copied to clipboard");
                    }}
                    className="gap-2"
                  >
                    <Phone className="h-4 w-4" />
                    Copy Phone
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
