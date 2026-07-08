"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Search, Users, Send, X } from "lucide-react";

import { toast } from "sonner";

interface User {
  id: string;
  name: string;
  role: string;
  phone?: string | null;
  email?: string | null;
}

interface SendSMSClientProps {
  user: User;
}

export default function SendSMSClient({ user }: SendSMSClientProps) {
  const [users, setUsers] = useState<any[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
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
        (user.phone &&
          user.phone.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (user.email &&
          user.email.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    setFilteredUsers(filtered);
  }, [users, searchTerm]);

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/v1/sms/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      setUsers(data.data ?? []);
      setFilteredUsers(data.data ?? []);
    } catch (error) {
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
    const filteredIds = filteredUsers
      .filter((user) => user.phone) // Only select users with phone numbers
      .map((user) => user.id);
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

  const handleSendSMS = async () => {
    if (!message.trim()) {
      toast.error("Please enter a message");
      return;
    }

    if (selectedUsers.length === 0) {
      toast.error("Please select at least one recipient");
      return;
    }

    setSending(true);
    try {
      const selectedPhones = users
        .filter((user) => selectedUsers.includes(user.id))
        .map((user) => user.phone)
        .filter(Boolean); // Remove any undefined/null phone numbers

      console.log("Selected phone numbers:", selectedPhones);

      if (selectedPhones.length === 0) {
        toast.error("No valid phone numbers found for selected users");
        setSending(false);
        return;
      }

      const response = await fetch("/api/v1/sms/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipients: selectedPhones,
          message,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to send SMS messages");
      }

      toast.success(
        `SMS sent successfully! ${result.sent} sent${
          result.failed > 0 ? `, ${result.failed} failed` : ""
        }!`
      );

      // Reset form
      setMessage("");
      setSelectedUsers([]);
    } catch (error: any) {
      console.error("Error sending SMS:", error);
      toast.error(error.message || "Failed to send SMS messages");
    } finally {
      setSending(false);
    }
  };

  const selectedUsersData = users.filter((user) =>
    selectedUsers.includes(user.id)
  );

  const usersWithPhones = users.filter((user) => user.phone);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Send SMS</h1>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Loading Recipients...</CardTitle>
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
          <h1 className="text-3xl font-bold">Send SMS</h1>
          <p className="text-muted-foreground">
            Send SMS messages to selected users
          </p>
        </div>
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-muted-foreground" />
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
              Select Recipients ({usersWithPhones.length} users with phone
              numbers)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users by name or phone..."
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
              {filteredUsers.map((user) => {
                const hasPhone = Boolean(user.phone);
                return (
                  <div
                    key={user.id}
                    className={`flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 ${
                      !hasPhone ? "opacity-50" : ""
                    }`}
                  >
                    <Checkbox
                      checked={selectedUsers.includes(user.id)}
                      onCheckedChange={() => toggleUserSelection(user.id)}
                      disabled={!hasPhone}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{user.name}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {user.phone || "No phone number"}
                      </p>
                    </div>
                    <Badge variant="secondary">{user.role}</Badge>
                  </div>
                );
              })}
            </div>

            {filteredUsers.length === 0 && searchTerm && (
              <div className="text-center py-8 text-muted-foreground">
                No users found matching "{searchTerm}"
              </div>
            )}

            {users.length === 0 && !loading && (
              <div className="text-center py-8 text-muted-foreground">
                <p>No users found</p>
                <p className="text-xs mt-2">
                  Check your database - users need phone numbers to receive SMS
                </p>
              </div>
            )}

            {usersWithPhones.length === 0 && users.length > 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <p>No users with phone numbers found</p>
                <p className="text-xs mt-2">
                  Users need phone numbers to receive SMS messages
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* SMS Composition */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Compose SMS
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Selected Recipients */}
            {selectedUsersData.length > 0 && (
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Selected Recipients:
                </label>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border rounded-lg bg-gray-50">
                  {selectedUsersData.map((user) => (
                    <Badge key={user.id} variant="secondary" className="gap-1">
                      {user.name}
                      <button
                        onClick={() => removeSelectedUser(user.id)}
                        className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
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
                Message
                <span className="text-xs text-muted-foreground ml-2">
                  ({message.length}/160 characters)
                </span>
              </label>
              <Textarea
                placeholder="Enter your SMS message here..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                className="resize-none"
                maxLength={160} // SMS character limit
              />
              <p className="text-xs text-muted-foreground mt-1">
                Standard SMS messages are limited to 160 characters
              </p>
            </div>

            <Button
              onClick={handleSendSMS}
              disabled={
                sending || selectedUsers.length === 0 || !message.trim()
              }
              className="w-full gap-2"
            >
              <Send className="h-4 w-4" />
              {sending
                ? "Sending..."
                : `Send SMS to ${selectedUsers.length} recipient${
                    selectedUsers.length !== 1 ? "s" : ""
                  }`}
            </Button>

            {/* SMS Info */}
            <div className="text-xs text-muted-foreground bg-blue-50 p-3 rounded-lg">
              <p className="font-medium mb-1">SMS Information:</p>
              <ul className="space-y-1">
                <li>• Messages are limited to 160 characters</li>
                <li>• Only users with phone numbers can receive SMS</li>
                <li>• Delivery depends on network availability</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
