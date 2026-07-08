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

export function FamilyInfoTab({ item }: { item: Member & { user: any } }) {
  return (
    <div className="grid gap-6 mt-6">
      <NextOfKinCard item={item} />
      <FamilyDetailsCard item={item} />
    </div>
  );
}

function NextOfKinCard({ item }: { item: Member & { user: any } }) {
  const [nokName, setNokName] = useState(item.nokName || "");
  const [nokRelationship, setNokRelationship] = useState(
    item.nokRelationship || ""
  );
  const [nokPhone, setNokPhone] = useState(item.nokPhone || "");
  const [numberOfChildren, setNumberOfChildren] = useState(
    item.numberOfChildren?.toString() || ""
  );
  const [numberOfDependants, setNumberOfDependants] = useState(
    item.numberOfDependants?.toString() || ""
  );
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdate = async () => {
    setIsUpdating(true);

    try {
      const data = {
        nokName: nokName || undefined,
        nokRelationship: nokRelationship || undefined,
        nokPhone: nokPhone || undefined,
        numberOfChildren: numberOfChildren
          ? parseInt(numberOfChildren)
          : undefined,
        numberOfDependants: numberOfDependants
          ? parseInt(numberOfDependants)
          : undefined,
      };

      const _res = await fetch(`/api/v1/members/${item.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); if (!_res.ok) { const _json = await _res.json(); throw new Error(_json.error || "Update failed"); }
      toast.success("Next of Kin information updated successfully");
    } catch (error) {
      toast.error("Failed to update Next of Kin information");
      console.error(error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Next of Kin & Dependants</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="grid gap-3">
            <Label htmlFor="nokName">Next of Kin Name</Label>
            <Input
              id="nokName"
              value={nokName}
              onChange={(e) => setNokName(e.target.value)}
              placeholder="Enter NOK name"
            />
          </div>

          <div className="grid gap-3">
            <Label htmlFor="nokRelationship">Relationship</Label>
            <Input
              id="nokRelationship"
              value={nokRelationship}
              onChange={(e) => setNokRelationship(e.target.value)}
              placeholder="Enter relationship"
            />
          </div>

          <div className="grid gap-3">
            <Label htmlFor="nokPhone">NOK Phone Number</Label>
            <Input
              id="nokPhone"
              type="tel"
              value={nokPhone}
              onChange={(e) => setNokPhone(e.target.value)}
              placeholder="Enter phone number"
            />
          </div>

          <div className="grid gap-3">
            <Label htmlFor="numberOfChildren">Number of Children</Label>
            <Input
              id="numberOfChildren"
              type="number"
              value={numberOfChildren}
              onChange={(e) => setNumberOfChildren(e.target.value)}
              placeholder="Enter number"
            />
          </div>

          <div className="grid gap-3">
            <Label htmlFor="numberOfDependants">Number of Dependants</Label>
            <Input
              id="numberOfDependants"
              type="number"
              value={numberOfDependants}
              onChange={(e) => setNumberOfDependants(e.target.value)}
              placeholder="Enter number"
            />
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleUpdate} disabled={isUpdating}>
          {isUpdating ? "Updating..." : "Update Next of Kin Information"}
        </Button>
      </CardFooter>
    </Card>
  );
}

function FamilyDetailsCard({ item }: { item: Member & { user: any } }) {
  const [fatherName, setFatherName] = useState(item.fatherName || "");
  const [motherName, setMotherName] = useState(item.motherName || "");
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdate = async () => {
    setIsUpdating(true);

    try {
      const data = {
        fatherName: fatherName || undefined,
        motherName: motherName || undefined,
      };

      const _res = await fetch(`/api/v1/members/${item.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); if (!_res.ok) { const _json = await _res.json(); throw new Error(_json.error || "Update failed"); }
      toast.success("Family details updated successfully");
    } catch (error) {
      toast.error("Failed to update family details");
      console.error(error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Parent Information</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="grid gap-3">
            <Label htmlFor="fatherName">Father's Name</Label>
            <Input
              id="fatherName"
              value={fatherName}
              onChange={(e) => setFatherName(e.target.value)}
              placeholder="Enter father's name"
            />
          </div>

          <div className="grid gap-3">
            <Label htmlFor="motherName">Mother's Name</Label>
            <Input
              id="motherName"
              value={motherName}
              onChange={(e) => setMotherName(e.target.value)}
              placeholder="Enter mother's name"
            />
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleUpdate} disabled={isUpdating}>
          {isUpdating ? "Updating..." : "Update Parent Information"}
        </Button>
      </CardFooter>
    </Card>
  );
}
