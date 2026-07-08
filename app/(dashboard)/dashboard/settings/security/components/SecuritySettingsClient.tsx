"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Shield, Key, Eye, EyeOff, Smartphone, Clock } from "lucide-react";
import { toast } from "sonner";

interface User {
  id: string;
  name: string;
  role: string;
  email?: string;
}

interface SecuritySettingsClientProps {
  user: User;
}

export default function SecuritySettingsClient({
  user,
}: SecuritySettingsClientProps) {
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [securitySettings, setSecuritySettings] = useState({
    twoFactorAuth: false,
    emailNotifications: true,
    loginAlerts: true,
    sessionTimeout: true,
  });

  const [saving, setSaving] = useState(false);

  const handlePasswordChange = (key: string, value: string) => {
    setPasswords((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSecuritySettingChange = (key: string, value: boolean) => {
    setSecuritySettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleChangePassword = async () => {
    if (
      !passwords.currentPassword ||
      !passwords.newPassword ||
      !passwords.confirmPassword
    ) {
      toast.error("Please fill in all password fields");
      return;
    }

    if (passwords.newPassword !== passwords.confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    if (passwords.newPassword.length < 8) {
      toast.error("Password must be at least 8 characters long");
      return;
    }

    setSaving(true);
    try {
      // Here you would typically save to your backend
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate API call
      toast.success("Password changed successfully!");
      setPasswords({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error) {
      toast.error("Failed to change password");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSecuritySettings = async () => {
    setSaving(true);
    try {
      // Here you would typically save to your backend
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate API call
      toast.success("Security settings updated successfully!");
    } catch (error) {
      toast.error("Failed to update security settings");
    } finally {
      setSaving(false);
    }
  };

  const activeSessions = [
    {
      id: 1,
      device: "Chrome on Windows",
      location: "Nairobi, Kenya",
      lastActive: "2 minutes ago",
      current: true,
    },
    {
      id: 2,
      device: "Safari on iPhone",
      location: "Nairobi, Kenya",
      lastActive: "1 hour ago",
      current: false,
    },
    {
      id: 3,
      device: "Firefox on Ubuntu",
      location: "Mombasa, Kenya",
      lastActive: "2 days ago",
      current: false,
    },
  ];

  return (
    <div className="space-y-6 p-2">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold px-10">Security Settings</h1>
          <p className="text-muted-foreground">
            Manage your account security and privacy
          </p>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Change Password */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Change Password
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-1 max-w-md">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <div className="relative">
                  <Input
                    id="currentPassword"
                    type={showCurrentPassword ? "text" : "password"}
                    value={passwords.currentPassword}
                    onChange={(e) =>
                      handlePasswordChange("currentPassword", e.target.value)
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? "text" : "password"}
                    value={passwords.newPassword}
                    onChange={(e) =>
                      handlePasswordChange("newPassword", e.target.value)
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={passwords.confirmPassword}
                    onChange={(e) =>
                      handlePasswordChange("confirmPassword", e.target.value)
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
            <Button
              onClick={handleChangePassword}
              disabled={saving}
              className="gap-2"
            >
              <Key className="h-4 w-4" />
              {saving ? "Changing..." : "Change Password"}
            </Button>
          </CardContent>
        </Card>

        {/* Security Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security Preferences
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Two-Factor Authentication</Label>
                <p className="text-sm text-muted-foreground">
                  Add an extra layer of security to your account
                </p>
              </div>
              <Switch
                checked={securitySettings.twoFactorAuth}
                onCheckedChange={(checked) =>
                  handleSecuritySettingChange("twoFactorAuth", checked)
                }
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Email Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive security alerts via email
                </p>
              </div>
              <Switch
                checked={securitySettings.emailNotifications}
                onCheckedChange={(checked) =>
                  handleSecuritySettingChange("emailNotifications", checked)
                }
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Login Alerts</Label>
                <p className="text-sm text-muted-foreground">
                  Get notified of new login attempts
                </p>
              </div>
              <Switch
                checked={securitySettings.loginAlerts}
                onCheckedChange={(checked) =>
                  handleSecuritySettingChange("loginAlerts", checked)
                }
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Auto Session Timeout</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically log out after inactivity
                </p>
              </div>
              <Switch
                checked={securitySettings.sessionTimeout}
                onCheckedChange={(checked) =>
                  handleSecuritySettingChange("sessionTimeout", checked)
                }
              />
            </div>
            <div className="pt-4">
              <Button
                onClick={handleSaveSecuritySettings}
                disabled={saving}
                variant="outline"
                className="gap-2 bg-transparent"
              >
                <Shield className="h-4 w-4" />
                {saving ? "Saving..." : "Save Security Settings"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Active Sessions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Active Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activeSessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Smartphone className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{session.device}</p>
                      <p className="text-sm text-muted-foreground">
                        {session.location}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Last active: {session.lastActive}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {session.current ? (
                      <Badge variant="default">Current Session</Badge>
                    ) : (
                      <Button variant="outline" size="sm">
                        Revoke
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
