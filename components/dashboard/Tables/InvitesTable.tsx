"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
// This would typically come from your database
const mockInvites = [
  {
    id: "1",
    email: "john.doe@example.com",
    status: false,
    createdAt: new Date("2023-09-15T10:30:00"),
  },
  {
    id: "2",
    email: "jane.smith@example.com",
    status: true,
    createdAt: new Date("2023-09-14T08:45:00"),
    updatedAt: new Date("2023-09-16T14:20:00"),
  },
  {
    id: "3",
    email: "michael.brown@example.com",
    status: false,
    createdAt: new Date("2023-09-13T16:15:00"),
    updatedAt: new Date("2023-09-13T16:15:00"),
  },
  {
    id: "4",
    email: "sarah.wilson@example.com",
    status: true,
    createdAt: new Date("2023-09-12T11:20:00"),
    updatedAt: new Date("2023-09-14T09:30:00"),
  },
  {
    id: "5",
    email: "david.johnson@example.com",
    status: false,
    createdAt: new Date("2023-09-11T14:50:00"),
    updatedAt: new Date("2023-09-11T14:50:00"),
  },
];

export type Invite = {
  id: string;
  email: string;
  status: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export default function InvitesTable({ data }: { data: Invite[] }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [invites, setInvites] = useState<Invite[]>(data);
  // Format date to a more readable format
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  };

  // Filter invites based on search query
  const filteredInvites = invites.filter((invite) =>
    invite.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by email..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredInvites.length > 0 ? (
              filteredInvites.map((invite) => (
                <TableRow key={invite.id}>
                  <TableCell className="font-medium">{invite.email}</TableCell>
                  <TableCell>
                    {invite.status ? (
                      <Badge className="bg-green-500 hover:bg-green-600">
                        Success
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-amber-500 border-amber-500"
                      >
                        Pending
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{formatDate(invite.createdAt)}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center">
                  No invites found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
