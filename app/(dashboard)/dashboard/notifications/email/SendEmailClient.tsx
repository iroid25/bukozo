"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Mail, Search, Users, Send, X } from "lucide-react";
import { toast } from "sonner";

interface User {
  id: string;
  name: string;
  role: string;
  email: string | null;
}

interface SendEmailClientProps {
  user: User;
}

export default function SendEmailClient({ user }: SendEmailClientProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    const filtered = users.filter(
      (user) =>
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.email &&
          user.email.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    setFilteredUsers(filtered);
  }, [users, searchTerm]);

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/v1/users?isActive=true");
      const json = await res.json();
      const usersData = json.data || json;
      setUsers(usersData);
      setFilteredUsers(usersData);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const selectAllFiltered = () => {
    const filteredIds = filteredUsers.map((user) => user.id);
    setSelectedUsers((prev) => {
      const newSelection = [...new Set([...prev, ...filteredIds])];
      return newSelection;
    });
  };

  const clearSelection = () => {
    setSelectedUsers([]);
  };

  const removeSelectedUser = (userId: string) => {
    setSelectedUsers((prev) => prev.filter((id) => id !== userId));
  };

  const handleSendEmail = async () => {
    if (!subject.trim() || !message.trim()) {
      toast.error("Please fill in both subject and message");
      return;
    }

    if (selectedUsers.length === 0) {
      toast.error("Please select at least one recipient");
      return;
    }

    setSending(true);
    try {
      const selectedEmails = users
        .filter((user) => selectedUsers.includes(user.id))
        .map((user) => user.email)
        .filter((email): email is string => Boolean(email)); // Type-safe filter

      if (selectedEmails.length === 0) {
        toast.error("No valid email addresses found for selected users");
        setSending(false);
        return;
      }

      const emailRes = await fetch("/api/v1/notifications/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipients: selectedEmails, subject, message }),
      });
      const result = await emailRes.json();
      if (!emailRes.ok) throw new Error(result.error || "Failed to send emails");

      if (result.failed > 0 && result.errors) {
        toast.warning(
          `Email sent with some issues: ${result.sent} sent, ${result.failed} failed`
        );
        console.log("Email errors:", result.errors);
      } else {
        toast.success(
          `Email sent successfully to ${result.sent} recipient${
            result.sent !== 1 ? "s" : ""
          }!`
        );
      }

      // Reset form
      setSubject("");
      setMessage("");
      setSelectedUsers([]);
    } catch (error: any) {
      console.error("Error sending email:", error);
      toast.error(error.message || "Failed to send emails");
    } finally {
      setSending(false);
    }
  };

  const selectedUsersData = users.filter((user) =>
    selectedUsers.includes(user.id)
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Send Email</h1>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Select Recipients</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-4 w-4 bg-gray-200 rounded animate-pulse" />
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded w-32 animate-pulse mb-1" />
                      <div className="h-3 bg-gray-200 rounded w-48 animate-pulse" />
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Send Email</h1>
          <p className="text-muted-foreground">Send emails to selected users</p>
        </div>
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {selectedUsers.length} recipient
            {selectedUsers.length !== 1 ? "s" : ""} selected
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* User Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Select Recipients ({users.length} available)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button variant="outline" onClick={selectAllFiltered} size="sm">
                Select All
              </Button>
              <Button variant="outline" onClick={clearSelection} size="sm">
                Clear
              </Button>
            </div>

            <div className="max-h-96 overflow-y-auto space-y-2">
              {filteredUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                  onClick={() => toggleUserSelection(user.id)}
                >
                  <Checkbox
                    checked={selectedUsers.includes(user.id)}
                    onCheckedChange={() => toggleUserSelection(user.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{user.name}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {user.email}
                    </p>
                  </div>
                  <Badge variant="secondary">{user.role}</Badge>
                </div>
              ))}
            </div>

            {filteredUsers.length === 0 && searchTerm && (
              <div className="text-center py-8 text-muted-foreground">
                No users found matching "{searchTerm}"
              </div>
            )}

            {users.length === 0 && !loading && (
              <div className="text-center py-8 text-muted-foreground">
                No users with email addresses found
              </div>
            )}
          </CardContent>
        </Card>

        {/* Email Composition */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Compose Email
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Selected Recipients */}
            {selectedUsersData.length > 0 && (
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Selected Recipients ({selectedUsersData.length}):
                </label>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border rounded-lg bg-gray-50">
                  {selectedUsersData.map((user) => (
                    <Badge key={user.id} variant="secondary" className="gap-1">
                      {user.name}
                      <button
                        onClick={() => removeSelectedUser(user.id)}
                        className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
                        title={`Remove ${user.name}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="text-sm font-medium mb-2 block">
                Subject <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="Enter email subject..."
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                Message <span className="text-red-500">*</span>
              </label>
              <Textarea
                placeholder="Enter your message here..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={8}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Line breaks will be preserved in the email
              </p>
            </div>

            <Button
              onClick={handleSendEmail}
              disabled={
                sending ||
                selectedUsers.length === 0 ||
                !subject.trim() ||
                !message.trim()
              }
              className="w-full gap-2"
            >
              <Send className="h-4 w-4" />
              {sending
                ? "Sending..."
                : `Send Email to ${selectedUsers.length} recipient${
                    selectedUsers.length !== 1 ? "s" : ""
                  }`}
            </Button>

            {/* Email Preview */}
            {subject && message && (
              <div className="mt-4 p-3 border rounded-lg bg-gray-50">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Email Preview:
                </p>
                <div className="text-sm">
                  <p className="font-medium">Subject: {subject}</p>
                  <div className="mt-2 text-muted-foreground">
                    {message.split("\n").map((line, index) => (
                      <p key={index}>{line || "\u00A0"}</p>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
