// app/dashboard/users/[id]/components/UserProfileSidebar.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  CreditCard,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  MapPin,
  Phone,
  Mail,
  Calendar,
  User,
  Heart,
  Users,
  Building,
} from "lucide-react";
import { format } from "date-fns";

interface UserProfileSidebarProps {
  user: any;
  member: any;
}

export default function UserProfileSidebar({
  user,
  member,
}: UserProfileSidebarProps) {
  // Mock data - replace with real data from your API
  const accountSummary = {
    totalBalance: 2500000, // UGX
    totalLoans: 1200000,
    activeAccounts: 3,
    creditScore: 85,
  };

  const quickStats = {
    depositsThisMonth: 150000,
    withdrawalsThisMonth: 75000,
    loanRepayments: 50000,
    lastTransactionDate: new Date(),
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getCreditScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getCreditScoreLabel = (score: number) => {
    if (score >= 80) return "Excellent";
    if (score >= 60) return "Good";
    return "Fair";
  };

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-lg text-blue-900">
            <TrendingUp className="w-5 h-5 mr-2" />
            Account Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-white/50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrency(accountSummary.totalBalance)}
              </div>
              <div className="text-xs text-gray-600">Total Balance</div>
            </div>
            <div className="text-center p-3 bg-white/50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {accountSummary.activeAccounts}
              </div>
              <div className="text-xs text-gray-600">Active Accounts</div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Outstanding Loans</span>
              <span className="font-semibold text-red-600">
                {formatCurrency(accountSummary.totalLoans)}
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Credit Score</span>
                <span
                  className={`font-bold ${getCreditScoreColor(accountSummary.creditScore)}`}
                >
                  {accountSummary.creditScore}/100
                </span>
              </div>
              <Progress value={accountSummary.creditScore} className="h-2" />
              <div className="text-xs text-center text-gray-500">
                {getCreditScoreLabel(accountSummary.creditScore)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact Information */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-lg">
            <User className="w-5 h-5 mr-2" />
            Contact Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {user.email && (
            <div className="flex items-center space-x-3">
              <Mail className="w-4 h-4 text-gray-400" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{user.email}</div>
                <div className="text-xs text-gray-500">Email</div>
              </div>
            </div>
          )}

          {user.phone && (
            <div className="flex items-center space-x-3">
              <Phone className="w-4 h-4 text-gray-400" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{user.phone}</div>
                <div className="text-xs text-gray-500">Phone</div>
              </div>
            </div>
          )}

          {member?.district && (
            <div className="flex items-center space-x-3">
              <MapPin className="w-4 h-4 text-gray-400" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">
                  {member.village && `${member.village}, `}
                  {member.district}
                </div>
                <div className="text-xs text-gray-500">Location</div>
              </div>
            </div>
          )}

          {user.dateOfBirth && (
            <div className="flex items-center space-x-3">
              <Calendar className="w-4 h-4 text-gray-400" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">
                  {format(new Date(user.dateOfBirth), "MMM dd, yyyy")}
                </div>
                <div className="text-xs text-gray-500">Date of Birth</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Family Information */}
      {member &&
        (member.nokName ||
          member.numberOfChildren ||
          member.numberOfDependants) && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-lg">
                <Users className="w-5 h-5 mr-2" />
                Family Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {member.nokName && (
                <div className="flex items-center space-x-3">
                  <Heart className="w-4 h-4 text-gray-400" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{member.nokName}</div>
                    <div className="text-xs text-gray-500">
                      Next of Kin{" "}
                      {member.nokRelationship && `(${member.nokRelationship})`}
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-2">
                {member.numberOfChildren !== null && (
                  <div className="text-center p-2 bg-gray-50 rounded">
                    <div className="text-lg font-bold text-gray-700">
                      {member.numberOfChildren || 0}
                    </div>
                    <div className="text-xs text-gray-500">Children</div>
                  </div>
                )}

                {member.numberOfDependants !== null && (
                  <div className="text-center p-2 bg-gray-50 rounded">
                    <div className="text-lg font-bold text-gray-700">
                      {member.numberOfDependants || 0}
                    </div>
                    <div className="text-xs text-gray-500">Dependants</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

      {/* Professional Information */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-lg">
            <Building className="w-5 h-5 mr-2" />
            Professional Info
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {user.jobTitle && (
            <div>
              <div className="text-sm font-medium">{user.jobTitle}</div>
              <div className="text-xs text-gray-500">Job Title</div>
            </div>
          )}

          {member?.occupation && (
            <div>
              <div className="text-sm font-medium">{member.occupation}</div>
              <div className="text-xs text-gray-500">Occupation</div>
            </div>
          )}

          {member?.levelOfEducation && (
            <div>
              <div className="text-sm font-medium">
                {member.levelOfEducation}
              </div>
              <div className="text-xs text-gray-500">Education Level</div>
            </div>
          )}

          {member?.citizenship && (
            <div>
              <div className="text-sm font-medium">{member.citizenship}</div>
              <div className="text-xs text-gray-500">Citizenship</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-lg">
            <Clock className="w-5 h-5 mr-2" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-3 text-sm">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <div className="flex-1">
                <div className="font-medium">Deposit</div>
                <div className="text-xs text-gray-500">
                  {formatCurrency(quickStats.depositsThisMonth)} • 2 hours ago
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <div className="flex-1">
                <div className="font-medium">Loan Repayment</div>
                <div className="text-xs text-gray-500">
                  {formatCurrency(quickStats.loanRepayments)} • Yesterday
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
              <div className="flex-1">
                <div className="font-medium">Withdrawal</div>
                <div className="text-xs text-gray-500">
                  {formatCurrency(quickStats.withdrawalsThisMonth)} • 3 days ago
                </div>
              </div>
            </div>
          </div>

          <Button variant="outline" size="sm" className="w-full mt-4">
            View All Activity
          </Button>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-lg">
            <CreditCard className="w-5 h-5 mr-2" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button variant="outline" size="sm" className="w-full justify-start">
            <DollarSign className="w-4 h-4 mr-2" />
            Process Deposit
          </Button>

          <Button variant="outline" size="sm" className="w-full justify-start">
            <TrendingUp className="w-4 h-4 mr-2" />
            Process Withdrawal
          </Button>

          <Button variant="outline" size="sm" className="w-full justify-start">
            <CheckCircle className="w-4 h-4 mr-2" />
            Approve Loan
          </Button>

          <Button variant="outline" size="sm" className="w-full justify-start">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Generate Statement
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
