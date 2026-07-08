// @ts-nocheck
"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Mail, MessageSquare, CheckCircle, Trash2, RefreshCcw } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface User {
  id: string;
  name: string;
  role: string;
}

interface Notification {
  id: string;
  type: string;
  subject: string;
  message: string;
  isRead: boolean;
  sentAt: string;
  userId: string;
  priority?: "HIGH" | "MEDIUM" | "LOW"; // Optional if not always present in DB response
}

interface NotificationsClientProps {
  user: User;
}

export default function NotificationsClient({
  user,
}: NotificationsClientProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/notifications?limit=50");
      const data = await res.json();

      if (data.success) {
        // The API returns { success: true, data: { data: [...], pagination: ..., unreadCount: ... } }
        setNotifications(data.data.data || []); 
        setUnreadCount(data.data.unreadCount || 0);
      } else {
        toast.error("Failed to load notifications");
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
      toast.error("Error loading notifications");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = async (id: string) => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((notif) =>
        notif.id === id ? { ...notif, isRead: true } : notif
      )
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      const res = await fetch("/api/v1/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: id }),
      });
      
      const data = await res.json();
      if (!data.success) {
        // Revert on failure
        fetchNotifications();
        toast.error("Failed to mark as read");
      }
    } catch (error) {
      fetchNotifications();
      toast.error("Error updating notification status");
    }
  };

  const deleteNotification = async (id: string) => {
    // Optimistic update
    const notificationToDelete = notifications.find(n => n.id === id);
    setNotifications((prev) => prev.filter((notif) => notif.id !== id));
    if (notificationToDelete && !notificationToDelete.isRead) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
    }

    try {
      const res = await fetch(`/api/v1/notifications?id=${id}`, {
        method: "DELETE",
      });
      
      const data = await res.json();
      if (!data.success) {
        fetchNotifications();
        toast.error("Failed to delete notification");
      } else {
        toast.success("Notification deleted");
      }
    } catch (error) {
      fetchNotifications();
      toast.error("Error deleting notification");
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "EMAIL":
        return <Mail className="h-4 w-4" />;
      case "SMS":
      case "IN_APP":
        return <MessageSquare className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case "HIGH":
        return "bg-red-100 text-red-800";
      case "MEDIUM":
        return "bg-yellow-100 text-yellow-800";
      case "LOW":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const filteredNotifications = notifications.filter((notif) => {
    if (filter === "all") return true;
    if (filter === "unread") return !notif.isRead;
    if (filter === "read") return notif.isRead;
    return notif.type === filter;
  });

  if (loading && notifications.length === 0) {
    return (
      <div className="space-y-6 px-4 md:px-10 py-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Notifications</h1>
        </div>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="h-8 w-8 bg-gray-200 rounded animate-pulse" />
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-48 animate-pulse mb-2" />
                    <div className="h-3 bg-gray-200 rounded w-96 animate-pulse" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-4 md:px-8 py-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Notifications</h1>
          <p className="text-muted-foreground">
            {unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
           <Button
            variant="outline"
            size="icon"
            onClick={fetchNotifications}
            title="Refresh"
          >
            <RefreshCcw className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            onClick={() => setFilter("all")}
            className={
              filter === "all" ? "bg-primary text-primary-foreground" : ""
            }
          >
            All
          </Button>
          <Button
            variant="outline"
            onClick={() => setFilter("unread")}
            className={
              filter === "unread" ? "bg-primary text-primary-foreground" : ""
            }
          >
            Unread
          </Button>
          <Button
            variant="outline"
            onClick={() => setFilter("EMAIL")}
            className={
              filter === "EMAIL" ? "bg-primary text-primary-foreground" : ""
            }
          >
            Email
          </Button>
          <Button
            variant="outline"
            onClick={() => setFilter("IN_APP")}
            className={
              filter === "IN_APP" ? "bg-primary text-primary-foreground" : ""
            }
          >
            System
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {filteredNotifications.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No notifications found</h3>
              <p className="text-muted-foreground">
                {filter !== "all" ? `No ${filter} notifications` : "You're all caught up!"}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredNotifications.map((notification) => (
            <Card
              key={notification.id}
              className={cn("transition-colors", {
                "bg-blue-50/50 border-blue-200": !notification.isRead,
              })}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div
                    className={cn("p-2 rounded-full hidden sm:flex", {
                      "bg-blue-100 text-blue-600":
                        notification.type === "EMAIL",
                      "bg-green-100 text-green-600":
                        notification.type === "SMS",
                      "bg-gray-100 text-gray-600":
                        notification.type === "IN_APP" || notification.type === "SYSTEM",
                    })}
                  >
                    {getIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className={cn("font-medium", !notification.isRead && "font-bold text-primary")}>{notification.subject}</h3>
                      {!notification.isRead && (
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-200 text-[10px] h-5">NEW</Badge>
                      )}
                      {notification.priority && (
                       <Badge className={getPriorityColor(notification.priority)}>{notification.priority}</Badge>
                      )}
                    </div>
                    <p className="text-sm text-foreground/80 mb-2 whitespace-pre-line">
                      {notification.message}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>
                        {format(new Date(notification.sentAt), "PPP p")}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row items-center gap-2">
                    {!notification.isRead && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => markAsRead(notification.id)}
                        className="h-8 px-2 lg:px-3"
                        title="Mark as read"
                      >
                        <CheckCircle className="h-4 w-4 sm:mr-1" />
                        <span className="hidden sm:inline">Read</span>
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteNotification(notification.id)}
                      className="h-8 px-2 lg:px-3 text-red-500 hover:text-red-700 hover:bg-red-50"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4 sm:mr-1" />
                      <span className="hidden sm:inline">Delete</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
