"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

import { Member } from "@/types/member";


export function AddressInfoTab({ item }: { item: Member & { user: any } }) {
  return (
    <div className="grid gap-6 mt-6">
      <AddressDetailsCard item={item} />
    </div>
  );
}

function AddressDetailsCard({ item }: { item: Member & { user: any } }) {
  const [village, setVillage] = useState(item.village || "");
  const [parish, setParish] = useState(item.parish || "");
  const [subCounty, setSubCounty] = useState(item.subCounty || "");
  const [constituency, setConstituency] = useState(item.constituency || "");
  const [town, setTown] = useState(item.town || "");
  const [district, setDistrict] = useState(item.district || "");
  const [postalAddress, setPostalAddress] = useState(item.postalAddress || "");
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdate = async () => {
    setIsUpdating(true);

    try {
      const data = {
        village: village || undefined,
        parish: parish || undefined,
        subCounty: subCounty || undefined,
        constituency: constituency || undefined,
        town: town || undefined,
        district: district || undefined,
        postalAddress: postalAddress || undefined,
      };

      const _res = await fetch(`/api/v1/members/${item.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); if (!_res.ok) { const _json = await _res.json(); throw new Error(_json.error || "Update failed"); }
      toast.success("Address information updated successfully");
    } catch (error) {
      toast.error("Failed to update address information");
      console.error(error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Address Information</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="grid gap-3">
            <Label htmlFor="village">Village</Label>
            <Input
              id="village"
              value={village}
              onChange={(e) => setVillage(e.target.value)}
              placeholder="Enter village"
            />
          </div>

          <div className="grid gap-3">
            <Label htmlFor="parish">Parish</Label>
            <Input
              id="parish"
              value={parish}
              onChange={(e) => setParish(e.target.value)}
              placeholder="Enter parish"
            />
          </div>

          <div className="grid gap-3">
            <Label htmlFor="subCounty">Sub County</Label>
            <Input
              id="subCounty"
              value={subCounty}
              onChange={(e) => setSubCounty(e.target.value)}
              placeholder="Enter sub county"
            />
          </div>

          <div className="grid gap-3">
            <Label htmlFor="constituency">Constituency</Label>
            <Input
              id="constituency"
              value={constituency}
              onChange={(e) => setConstituency(e.target.value)}
              placeholder="Enter constituency"
            />
          </div>

          <div className="grid gap-3">
            <Label htmlFor="town">Town</Label>
            <Input
              id="town"
              value={town}
              onChange={(e) => setTown(e.target.value)}
              placeholder="Enter town"
            />
          </div>

          <div className="grid gap-3">
            <Label htmlFor="district">District</Label>
            <Input
              id="district"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              placeholder="Enter district"
            />
          </div>

          <div className="grid gap-3 md:col-span-2 lg:col-span-3">
            <Label htmlFor="postalAddress">Postal Address</Label>
            <Input
              id="postalAddress"
              value={postalAddress}
              onChange={(e) => setPostalAddress(e.target.value)}
              placeholder="Enter postal address (e.g., P.O. Box 123, Kampala)"
            />
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleUpdate} disabled={isUpdating}>
          {isUpdating ? "Updating..." : "Update Address Information"}
        </Button>
      </CardFooter>
    </Card>
  );
}
