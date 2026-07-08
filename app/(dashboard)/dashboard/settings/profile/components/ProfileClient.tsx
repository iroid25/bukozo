"use client";

import React, { useState } from "react";
import {
  Camera,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Briefcase,
  User,
  Building2,
  Shield,
  Edit2,
  Save,
  X,
  Loader2,
  KeyRound,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface ProfilePageProps {
  user: any;
}

const ROLE_CONFIG: Record<string, { label: string; color: string }> = {
  ADMIN:          { label: "Administrator",    color: "bg-red-100 text-red-800 border-red-200" },
  BRANCHMANAGER:  { label: "Branch Manager",   color: "bg-purple-100 text-purple-800 border-purple-200" },
  TELLER:         { label: "Teller",           color: "bg-blue-100 text-blue-800 border-blue-200" },
  AGENT:          { label: "Agent",            color: "bg-amber-100 text-amber-800 border-amber-200" },
  MEMBER:         { label: "Member",           color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  ACCOUNTANT:     { label: "Accountant",       color: "bg-cyan-100 text-cyan-800 border-cyan-200" },
  LOANOFFICER:    { label: "Loan Officer",     color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  INSTITUTION:    { label: "Institution",      color: "bg-slate-100 text-slate-800 border-slate-200" },
  AUDITOR:        { label: "Auditor",          color: "bg-orange-100 text-orange-800 border-orange-200" },
  ACCOUNT_OPENER: { label: "Account Opener",   color: "bg-sky-100 text-sky-800 border-sky-200" },
};

function ViewField({ label, value, icon: Icon }: { label: string; value?: string | null; icon?: React.ElementType }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="flex items-center gap-1.5 text-sm text-foreground">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
        {value || <span className="text-muted-foreground/60 italic">Not provided</span>}
      </p>
    </div>
  );
}

function EditField({
  label,
  value,
  type = "text",
  onChange,
  required,
}: {
  label: string;
  value: string;
  type?: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}
        {required && <span className="ml-1 text-rose-500">*</span>}
      </Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9"
        required={required}
      />
    </div>
  );
}

export default function UserProfilePage({ user }: ProfilePageProps) {
  if (!user) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">Loading profile…</p>
        </div>
      </div>
    );
  }

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedUser, setEditedUser] = useState({
    firstName: user.firstName || "",
    lastName: user.lastName || "",
    email: user.email || "",
    phone: user.phone || "",
    dateOfBirth: user.dateOfBirth ? new Date(user.dateOfBirth).toISOString().split("T")[0] : "",
    address: user.address || "",
    nationalId: user.nationalId || "",
    jobTitle: user.jobTitle || "",
    areaOfOperation: user.areaOfOperation || "",
    image: user.image || "",
  });

  const set = (field: string, value: string) =>
    setEditedUser((prev) => ({ ...prev, [field]: value }));

  const handleCancel = () => {
    setIsEditing(false);
    setEditedUser({
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      email: user.email || "",
      phone: user.phone || "",
      dateOfBirth: user.dateOfBirth ? new Date(user.dateOfBirth).toISOString().split("T")[0] : "",
      address: user.address || "",
      nationalId: user.nationalId || "",
      jobTitle: user.jobTitle || "",
      areaOfOperation: user.areaOfOperation || "",
      image: user.image || "",
    });
  };

  const handleSave = async () => {
    if (!editedUser.firstName.trim() || !editedUser.lastName.trim()) {
      toast.error("First and last name are required");
      return;
    }
    if (!editedUser.email.trim()) {
      toast.error("Email is required");
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch(`/api/v1/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: editedUser.firstName.trim(),
          lastName: editedUser.lastName.trim(),
          email: editedUser.email.trim(),
          phone: editedUser.phone?.trim() || null,
          dateOfBirth: editedUser.dateOfBirth || null,
          address: editedUser.address?.trim() || null,
          nationalId: editedUser.nationalId?.trim() || null,
          jobTitle: editedUser.jobTitle?.trim() || null,
          areaOfOperation: editedUser.areaOfOperation?.trim() || null,
          image: editedUser.image?.trim() || null,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || "Failed to update profile");
      } else {
        toast.success("Profile updated successfully");
        setIsEditing(false);
        setTimeout(() => { window.location.reload(); }, 800);
      }
    } catch {
      toast.error("Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (date?: Date | string | null) => {
    if (!date) return null;
    return new Date(date).toLocaleDateString("en-UG", { year: "numeric", month: "long", day: "numeric" });
  };

  const getInitials = (name: string) =>
    (name || "U").split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  const roleCfg = ROLE_CONFIG[user.role] ?? { label: user.role, color: "bg-slate-100 text-slate-800 border-slate-200" };

  return (
    <div className="space-y-6 p-6">
      {/* ── Hero Banner ── */}
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-r from-sky-600 via-indigo-600 to-indigo-700 shadow-lg">
        {/* Decorative circles */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -right-4 -bottom-12 h-40 w-40 rounded-full bg-white/5" />

        <div className="relative flex flex-col gap-4 p-6 sm:flex-row sm:items-end sm:gap-6">
          {/* Avatar */}
          <div className="relative shrink-0">
            {user.image ? (
              <Image
                src={user.image}
                alt={user.name || "Profile"}
                width={96}
                height={96}
                className="h-24 w-24 rounded-2xl border-4 border-white/30 object-cover shadow-lg"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-2xl border-4 border-white/30 bg-white/20 shadow-lg backdrop-blur-sm">
                <span className="text-3xl font-bold text-white">{getInitials(user.name)}</span>
              </div>
            )}
            <button className="absolute -bottom-1 -right-1 rounded-lg bg-white p-1.5 shadow-md hover:bg-slate-50 transition-colors">
              <Camera className="h-3.5 w-3.5 text-slate-600" />
            </button>
          </div>

          {/* Name & role */}
          <div className="flex-1 min-w-0 pb-1">
            <h1 className="text-2xl font-bold text-white truncate">{user.name || "Unknown User"}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-xs font-semibold ${roleCfg.color}`}>
                <Shield className="h-3 w-3" />
                {roleCfg.label}
              </span>
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-xs font-semibold ${user.isActive ? "bg-emerald-100 text-emerald-800 border-emerald-200" : "bg-rose-100 text-rose-800 border-rose-200"}`}>
                <CheckCircle2 className="h-3 w-3" />
                {user.isActive ? "Active" : "Inactive"}
              </span>
              {user.branch?.name && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-0.5 text-xs font-medium text-white">
                  <Building2 className="h-3 w-3" />
                  {user.branch.name}
                </span>
              )}
            </div>
          </div>

          {/* Edit controls */}
          <div className="shrink-0">
            {!isEditing ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setIsEditing(true)}
                className="gap-2 bg-white/90 hover:bg-white text-slate-800"
              >
                <Edit2 className="h-3.5 w-3.5" />
                Edit Profile
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="gap-2 bg-white/80 hover:bg-white text-slate-700"
                >
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="gap-2 bg-emerald-500 hover:bg-emerald-600 text-white border-0"
                >
                  {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  {isSaving ? "Saving…" : "Save Changes"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Info Grid ── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Personal */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-sky-600" />
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isEditing ? (
              <>
                <EditField label="First Name" value={editedUser.firstName} onChange={(v) => set("firstName", v)} required />
                <EditField label="Last Name" value={editedUser.lastName} onChange={(v) => set("lastName", v)} required />
                <EditField label="Date of Birth" value={editedUser.dateOfBirth} type="date" onChange={(v) => set("dateOfBirth", v)} />
                <EditField label="National ID" value={editedUser.nationalId} onChange={(v) => set("nationalId", v)} />
              </>
            ) : (
              <>
                <ViewField label="First Name" value={user.firstName} />
                <ViewField label="Last Name" value={user.lastName} />
                <ViewField label="Date of Birth" value={formatDate(user.dateOfBirth)} icon={Calendar} />
                <ViewField label="National ID" value={user.nationalId} />
              </>
            )}
          </CardContent>
        </Card>

        {/* Contact */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-sky-600" />
              Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isEditing ? (
              <>
                <EditField label="Email Address" value={editedUser.email} type="email" onChange={(v) => set("email", v)} required />
                <EditField label="Phone Number" value={editedUser.phone} type="tel" onChange={(v) => set("phone", v)} />
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Address</Label>
                  <textarea
                    value={editedUser.address}
                    onChange={(e) => set("address", e.target.value)}
                    rows={3}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                  />
                </div>
              </>
            ) : (
              <>
                <ViewField label="Email Address" value={user.email} icon={Mail} />
                <ViewField label="Phone Number" value={user.phone} icon={Phone} />
                <ViewField label="Address" value={user.address} icon={MapPin} />
              </>
            )}
          </CardContent>
        </Card>

        {/* Work */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Briefcase className="h-4 w-4 text-sky-600" />
              Work Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isEditing ? (
              <>
                <EditField label="Job Title" value={editedUser.jobTitle} onChange={(v) => set("jobTitle", v)} />
                <EditField label="Area of Operation" value={editedUser.areaOfOperation} onChange={(v) => set("areaOfOperation", v)} />
                <div className="space-y-0.5 pt-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Branch</p>
                  <p className="text-sm text-muted-foreground italic">(Managed by admin)</p>
                </div>
              </>
            ) : (
              <>
                <ViewField label="Job Title" value={user.jobTitle} icon={Briefcase} />
                <ViewField label="Area of Operation" value={user.areaOfOperation} />
                <div className="space-y-0.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Branch</p>
                  <p className="flex items-center gap-1.5 text-sm">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    {user.branch?.name || <span className="text-muted-foreground/60 italic">Not assigned</span>}
                  </p>
                  {user.branch?.location && (
                    <p className="ml-5 text-xs text-muted-foreground">{user.branch.location}</p>
                  )}
                </div>
                <ViewField label="Member Since" value={formatDate(user.createdAt)} icon={Calendar} />
              </>
            )}
          </CardContent>
        </Card>

        {/* Account Activity */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Shield className="h-4 w-4 text-sky-600" />
              Account Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</p>
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${user.isActive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"}`}>
                <CheckCircle2 className="h-3 w-3" />
                {user.isActive ? "Active & in good standing" : "Account inactive"}
              </span>
            </div>

            <div className="space-y-0.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Last Login</p>
              <p className="flex items-center gap-1.5 text-sm">
                <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                {user.lastLogin
                  ? new Date(user.lastLogin).toLocaleString("en-UG", { dateStyle: "medium", timeStyle: "short" })
                  : <span className="text-muted-foreground/60 italic">Never</span>}
              </p>
            </div>

            <div className="space-y-0.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Role</p>
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${roleCfg.color}`}>
                <Shield className="h-3 w-3" />
                {roleCfg.label}
              </span>
            </div>

            <Separator />

            <a
              href="/dashboard/settings/change-password"
              className="flex items-center gap-2 text-sm font-medium text-sky-600 hover:text-sky-700 transition-colors"
            >
              <KeyRound className="h-4 w-4" />
              Change Password
            </a>
          </CardContent>
        </Card>
      </div>

      {/* SACCO branding footer note */}
      <div className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 dark:bg-sky-950/30 dark:border-sky-800">
        <p className="text-xs text-sky-700 dark:text-sky-300">
          <strong>Bukonzo United Teachers&apos; SACCO</strong> — This profile is used across the BUTCS management
          system. Contact your administrator to update branch assignment or change your role.
        </p>
      </div>
    </div>
  );
}
