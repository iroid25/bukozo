"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Bell,
  CheckCheck,
  Info,
  AlertCircle,
  MessageSquare,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NotificationItem {
  id: string;
  title: string;
  description: string;
  time: string;
  type: "info" | "success" | "warning" | "error";
  read: boolean;
}

interface NotificationDropdownProps {
  role: "client" | "staff";
}

export default function NotificationDropdown({
  role,
}: NotificationDropdownProps) {
  // Generate relevant notifications based on user role
  const getNotifications = (role: "client" | "staff"): NotificationItem[] => {
    if (role === "client") {
      return [
        {
          id: "n1",
          title: "Loan Approved",
          description: "Your business loan application has been approved",
          time: "10 minutes ago",
          type: "success",
          read: false,
        },
        {
          id: "n2",
          title: "Transaction Completed",
          description: "Your deposit of UGX 250,000 has been processed",
          time: "2 hours ago",
          type: "info",
          read: false,
        },
        {
          id: "n3",
          title: "Loan Payment Due",
          description:
            "Your monthly loan payment of UGX 120,000 is due in 3 days",
          time: "1 day ago",
          type: "warning",
          read: true,
        },
        {
          id: "n4",
          title: "Profile Update",
          description: "Your profile information has been updated successfully",
          time: "3 days ago",
          type: "success",
          read: true,
        },
        {
          id: "n5",
          title: "New Service Available",
          description: "Mobile Money transfers now available at reduced rates",
          time: "1 week ago",
          type: "info",
          read: true,
        },
      ];
    } else {
      return [
        {
          id: "n1",
          title: "New Loan Application",
          description: "Robert Mukasa has submitted a loan application",
          time: "5 minutes ago",
          type: "info",
          read: false,
        },
        {
          id: "n2",
          title: "Transaction Flagged",
          description: "Unusual deposit activity detected for review",
          time: "1 hour ago",
          type: "warning",
          read: false,
        },
        {
          id: "n3",
          title: "New Client Registration",
          description: "Sarah Nabukenya has registered as a new client",
          time: "3 hours ago",
          type: "success",
          read: false,
        },
        {
          id: "n4",
          title: "System Maintenance",
          description: "Scheduled maintenance tonight from 11PM to 2AM",
          time: "5 hours ago",
          type: "warning",
          read: true,
        },
        {
          id: "n5",
          title: "Loan Overdue",
          description: "5 clients have overdue loan payments requiring action",
          time: "1 day ago",
          type: "error",
          read: true,
        },
      ];
    }
  };

  const [notifications, setNotifications] = useState<NotificationItem[]>(
    getNotifications(role)
  );
  const [open, setOpen] = useState(false);

  const unreadCount = notifications.filter(
    (notification) => !notification.read
  ).length;

  const markAllAsRead = () => {
    setNotifications((prev) =>
      prev.map((notification) => ({ ...notification, read: true }))
    );
  };

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((notification) =>
        notification.id === id ? { ...notification, read: true } : notification
      )
    );
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "success":
        return <CheckCheck className="h-4 w-4 text-green-500" />;
      case "info":
        return <Info className="h-4 w-4 text-blue-500" />;
      case "warning":
        return <AlertCircle className="h-4 w-4 text-amber-500" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-fullbg-[#1e40af] text-[10px] font-medium text-white">
              {unreadCount}
            </span>
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[350px]">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="h-auto py-1 px-2 text-xs"
            >
              Mark all as read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup className="max-h-[300px] overflow-auto">
          {notifications.length > 0 ? (
            notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className={cn(
                  "flex cursor-pointer flex-col items-start gap-1 px-4 py-2",
                  !notification.read && "bg-slate-50"
                )}
                onClick={() => markAsRead(notification.id)}
              >
                <div className="flex w-full items-start gap-2">
                  <div className="shrink-0 pt-1">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{notification.title}</p>
                    <p className="text-sm text-slate-600">
                      {notification.description}
                    </p>
                    <div className="mt-1 flex items-center text-xs text-slate-400">
                      <Clock className="mr-1 h-3 w-3" />
                      {notification.time}
                    </div>
                  </div>
                </div>
              </DropdownMenuItem>
            ))
          ) : (
            <div className="px-4 py-8 text-center">
              <MessageSquare className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 text-sm text-slate-500">No notifications</p>
            </div>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <div className="p-2">
          <Button variant="outline" size="sm" className="w-full">
            View all notifications
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
