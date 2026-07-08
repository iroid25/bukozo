"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Bell,
  Check,
  Trash2,
  Search,
  Filter,
  X,
  CheckCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

import { toast } from "sonner";

interface Notification {
  id: string;
  subject: string | null;
  message: string;
  type: "EMAIL" | "SMS" | "IN_APP";
  sentAt: Date;
  isRead: boolean;
  targetAddress: string | null;
}

export function NotificationDropdown() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<
    "all" | "EMAIL" | "SMS" | "IN_APP"
  >("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "read" | "unread">(
    "all"
  );
  const [filterDateRange, setFilterDateRange] = useState<
    "all" | "today" | "week" | "month"
  >("all");
  const [showFilters, setShowFilters] = useState(false);

  // Fetch notifications
  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    setLoading(true);
    const res = await fetch("/api/v1/notifications");
    const json = await res.json();
    if (json.success && json.data?.data) {
      setNotifications(json.data.data as any);
    }
    setLoading(false);
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const filteredNotifications = useMemo(() => {
    return notifications.filter((notification) => {
      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        (notification.subject?.toLowerCase().includes(searchLower) || false) ||
        (notification.message?.toLowerCase().includes(searchLower) || false);

      if (!matchesSearch) return false;

      // Type filter
      if (filterType !== "all" && notification.type !== filterType)
        return false;

      // Read/Unread filter
      if (filterStatus === "read" && !notification.isRead) return false;
      if (filterStatus === "unread" && notification.isRead) return false;

      // Date range filter
      if (filterDateRange !== "all") {
        const now = new Date();
        const notifDate = new Date(notification.sentAt);
        const diffTime = now.getTime() - notifDate.getTime();
        const diffDays = diffTime / (1000 * 60 * 60 * 24);

        switch (filterDateRange) {
          case "today":
            if (diffDays > 1) return false;
            break;
          case "week":
            if (diffDays > 7) return false;
            break;
          case "month":
            if (diffDays > 30) return false;
            break;
        }
      }

      return true;
    });
  }, [notifications, searchQuery, filterType, filterStatus, filterDateRange]);

  const handleMarkAsRead = async (id: string) => {
    const res = await fetch("/api/v1/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationId: id }),
    });
    const json = await res.json();
    if (json.success) {
      setNotifications(notifications.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    }
  };

  const handleMarkAllAsRead = async () => {
    const res = await fetch("/api/v1/notifications/mark-all-read", { method: "PUT" });
    const json = await res.json();
    if (json.success) {
      setNotifications(notifications.map((n) => ({ ...n, isRead: true })));
      toast.success("All notifications marked as read");
    } else {
      toast.error("Failed to mark all as read");
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/v1/notifications?id=${id}`, { method: "DELETE" });
    const json = await res.json();
    if (json.success) {
      setNotifications(notifications.filter((n) => n.id !== id));
      toast.success("Notification deleted");
    } else {
      toast.error("Failed to delete notification");
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read if not already
    if (!notification.isRead) {
      await handleMarkAsRead(notification.id);
    }

    // Navigate if there's a target address
    if (notification.targetAddress) {
      router.push(notification.targetAddress);
    }
  };

  const resetFilters = () => {
    setSearchQuery("");
    setFilterType("all");
    setFilterStatus("all");
    setFilterDateRange("all");
    setShowFilters(false);
  };

  const getTypeBadgeStyles = (type: string) => {
    switch (type) {
      case "EMAIL":
        return "bg-blue-100 text-blue-800";
      case "SMS":
        return "bg-green-100 text-green-800";
      case "IN_APP":
      default:
        return "bg-purple-100 text-purple-800";
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
              {unreadCount}
            </span>
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex flex-col border-b">
          {/* Header */}
          <div className="flex items-center justify-between p-4">
            <h2 className="text-lg font-semibold">Notifications</h2>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <>
                  <Badge variant="secondary">{unreadCount} new</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleMarkAllAsRead}
                    title="Mark all as read"
                  >
                    <CheckCheck className="h-4 w-4" />
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className={cn(showFilters && "bg-gray-100")}
              >
                <Filter className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="px-4 pb-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search notifications..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="border-t p-4 space-y-3 bg-gray-50">
              {/* Type Filter */}
              <div>
                <p className="text-sm font-medium mb-2">Type</p>
                <div className="flex flex-wrap gap-2">
                  {["all", "IN_APP", "EMAIL", "SMS"].map((type) => (
                    <Button
                      key={type}
                      variant={filterType === type ? "default" : "outline"}
                      size="sm"
                      onClick={() => setFilterType(type as any)}
                      className="capitalize"
                    >
                      {type === "IN_APP" ? "In App" : type.toLowerCase()}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Status Filter */}
              <div>
                <p className="text-sm font-medium mb-2">Status</p>
                <div className="flex gap-2">
                  {["all", "read", "unread"].map((status) => (
                    <Button
                      key={status}
                      variant={filterStatus === status ? "default" : "outline"}
                      size="sm"
                      onClick={() => setFilterStatus(status as any)}
                      className="capitalize"
                    >
                      {status}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Date Range Filter */}
              <div>
                <p className="text-sm font-medium mb-2">Date</p>
                <div className="flex flex-wrap gap-2">
                  {["all", "today", "week", "month"].map((range) => (
                    <Button
                      key={range}
                      variant={
                        filterDateRange === range ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() => setFilterDateRange(range as any)}
                      className="capitalize"
                    >
                      {range === "all" ? "All Time" : range}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Reset Filters */}
              <Button
                variant="outline"
                size="sm"
                onClick={resetFilters}
                className="w-full bg-transparent"
              >
                Reset Filters
              </Button>
            </div>
          )}
        </div>

        {/* Notifications List */}
        {loading ? (
          <div className="p-8 text-center">
            <p className="text-sm text-gray-500">Loading notifications...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="p-8 text-center">
            <Bell className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm text-gray-500">
              {notifications.length === 0
                ? "No notifications yet"
                : "No notifications match your filters"}
            </p>
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={cn(
                  "p-4 border-b last:border-b-0 hover:bg-gray-50 transition-colors cursor-pointer",
                  !notification.isRead && "bg-blue-50/30"
                )}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-sm">
                        {notification.subject || "Notification"}
                      </h3>
                      {!notification.isRead && (
                        <div className="h-2 w-2 rounded-full bg-blue-600"></div>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">
                      {notification.message}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge
                        className={cn(
                          "text-xs",
                          getTypeBadgeStyles(notification.type)
                        )}
                      >
                        {notification.type === "IN_APP"
                          ? "In App"
                          : notification.type}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {formatTime(new Date(notification.sentAt))}
                      </span>
                    </div>
                  </div>

                  <div
                    className="flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {!notification.isRead && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMarkAsRead(notification.id)}
                        title="Mark as read"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(notification.id)}
                      title="Delete notification"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function formatTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString();
}
