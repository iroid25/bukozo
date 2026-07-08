"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Bell,
  CreditCard,
  LogOut,
  Settings,
  Sparkles,
  ChevronsUpDown,
  ShoppingBag,
  TrendingUp,
} from "lucide-react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface UserDropdownProps {
  username: string;
  email: string;
  avatarUrl?: string;
}

export function UserDropdownMenu({
  username,
  email,
  avatarUrl,
}: UserDropdownProps) {
  const router = useRouter();
  async function handleLogout() {
    try {
      await signOut();
      router.push("/auth");
    } catch (error) {
      console.log(error);
    }
  }

  const handleUpgrade = () => {
    // Add your upgrade logic here
    console.log("Upgrading to Pro...");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="relative h-8 px-2  hover:bg-transparent hover:text-orange-500"
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src={avatarUrl} alt={username} />
            <AvatarFallback className="text-xs">{username[0]}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <div className="flex flex-col space-y-1 p-2">
          <p className="text-sm font-medium leading-none">{username}</p>
          <p className="text-xs leading-none text-muted-foreground">{email}</p>
        </div>
        <DropdownMenuSeparator />
        {/* <DropdownMenuItem onClick={handleUpgrade} className="cursor-pointer">
          <Sparkles className="mr-2 h-4 w-4" />
          <span>Upgrade to Pro</span>
        </DropdownMenuItem> */}
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {/* <Link
            className="flex items-center gap-1"
            href="/dashboard/my-courses"
          >
            <DropdownMenuItem>
              <ShoppingBag className="mr-2 h-4 w-4" />
              <span>My Courses</span>
            </DropdownMenuItem>
          </Link> */}
          <DropdownMenuItem>
            <Link className="flex items-center gap-1" href="/dashboard">
              <TrendingUp className="mr-2 h-4 w-4" />
              <span>Dashboard</span>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
