// app/dashboard/users/[id]/components/UserProfileHeader.tsx
"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Mail,
  Phone,
  MapPin,
  Calendar,
  UserCheck,
  UserX,
  Shield,
  Crown,
  User,
  Settings,
  MessageSquare,
  MoreHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";

interface UserProfileHeaderProps {
  user: any;
  member: any;
}

export default function UserProfileHeader({
  user,
  member,
}: UserProfileHeaderProps) {
  const getRoleIcon = (role: string) => {
    switch (role) {
      case "ADMIN":
        return <Crown className="w-4 h-4" />;
      case "BRANCHMANAGER":
        return <Shield className="w-4 h-4" />;
      case "TELLER":
      case "AGENT":
        return <UserCheck className="w-4 h-4" />;
      default:
        return <User className="w-4 h-4" />;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "ADMIN":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "BRANCHMANAGER":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "TELLER":
        return "bg-green-100 text-green-800 border-green-200";
      case "AGENT":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "MEMBER":
        return "bg-gray-100 text-gray-800 border-gray-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStatusBadge = () => {
    if (member?.isApproved) {
      return (
        <Badge className="bg-green-100 text-green-800 border-green-200">
          <UserCheck className="w-3 h-3 mr-1" />
          Approved Member
        </Badge>
      );
    } else if (member && !member.isApproved) {
      return (
        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
          <UserX className="w-3 h-3 mr-1" />
          Pending Approval
        </Badge>
      );
    }
    return null;
  };

  return (
    <Card className="bg-gradient-to-r from-white via-blue-50 to-indigo-50 border-none shadow-xl">
      <CardContent className="p-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-6 lg:space-y-0">
          {/* Left Section - User Info */}
          <div className="flex items-center space-x-6">
            {/* Avatar */}
            <div className="relative">
              <Avatar className="w-24 h-24 border-4 border-white shadow-lg">
                <AvatarImage src={user.image} alt={user.name} />
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-2xl font-bold">
                  {user.firstName?.[0]}
                  {user.lastName?.[0]}
                </AvatarFallback>
              </Avatar>
              {user.isActive && (
                <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-green-500 border-4 border-white rounded-full"></div>
              )}
            </div>

            {/* User Details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-3 mb-2">
                <h1 className="text-3xl font-bold text-gray-900 truncate">
                  {user.name}
                </h1>
                <Badge
                  className={`${getRoleBadgeColor(user.role)} font-medium`}
                >
                  {getRoleIcon(user.role)}
                  <span className="ml-1">{user.role.replace("_", " ")}</span>
                </Badge>
              </div>

              {member && (
                <div className="flex items-center space-x-2 mb-3">
                  <span className="text-sm font-medium text-gray-600">
                    Member Number:
                  </span>
                  <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                    {member.memberNumber}
                  </span>
                  {getStatusBadge()}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                {user.email && (
                  <div className="flex items-center space-x-1">
                    <Mail className="w-4 h-4" />
                    <span>{user.email}</span>
                  </div>
                )}
                {user.phone && (
                  <div className="flex items-center space-x-1">
                    <Phone className="w-4 h-4" />
                    <span>{user.phone}</span>
                  </div>
                )}
                {user.dateOfBirth && (
                  <div className="flex items-center space-x-1">
                    <Calendar className="w-4 h-4" />
                    <span>
                      Born {format(new Date(user.dateOfBirth), "MMM dd, yyyy")}
                    </span>
                  </div>
                )}
              </div>

              {user.jobTitle && (
                <div className="mt-2">
                  <span className="text-sm text-gray-600">{user.jobTitle}</span>
                </div>
              )}
            </div>
          </div>

          {/* Right Section - Actions */}
          <div className="flex items-center space-x-3">
            <Button variant="outline" size="sm" className="hidden sm:flex">
              <MessageSquare className="w-4 h-4 mr-2" />
              Message
            </Button>

            <Button variant="outline" size="sm">
              <Settings className="w-4 h-4 mr-2" />
              Edit Profile
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <UserCheck className="w-4 h-4 mr-2" />
                  View Full Profile
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Mail className="w-4 h-4 mr-2" />
                  Send Email
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="w-4 h-4 mr-2" />
                  Account Settings
                </DropdownMenuItem>
                {member && !member.isApproved && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-green-600">
                      <UserCheck className="w-4 h-4 mr-2" />
                      Approve Member
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-red-600">
                      <UserX className="w-4 h-4 mr-2" />
                      Reject Application
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Member Registration Info */}
        {member && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Member Since</span>
                <div className="font-medium">
                  {format(new Date(member.registrationDate), "MMM dd, yyyy")}
                </div>
              </div>
              <div>
                <span className="text-gray-500">Last Login</span>
                <div className="font-medium">
                  {user.lastLogin
                    ? format(new Date(user.lastLogin), "MMM dd, yyyy")
                    : "Never"}
                </div>
              </div>
              <div>
                <span className="text-gray-500">Account Status</span>
                <div className="font-medium">
                  <Badge
                    variant={user.isActive ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {user.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>
              <div>
                <span className="text-gray-500">Email Verified</span>
                <div className="font-medium">
                  <Badge
                    variant={user.emailVerified ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {user.emailVerified ? "Verified" : "Unverified"}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
