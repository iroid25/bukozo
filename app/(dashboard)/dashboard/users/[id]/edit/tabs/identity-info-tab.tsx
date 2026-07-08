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
// import { SingleImageInput } from "@/components/FormInputs/SingleImageInput";

export function IdentityInfoTab({ item }: { item: Member & { user: any } }) {
  return (
    <div className="grid gap-6 mt-6">
      <IdentityDetailsCard item={item} />
      <DocumentsCard item={item} />
    </div>
  );
}

function IdentityDetailsCard({ item }: { item: Member & { user: any } }) {
  const [nin, setNin] = useState(item.nin || "");
  const [typeOfId, setTypeOfId] = useState(item.typeOfId || "");
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdate = async () => {
    setIsUpdating(true);

    try {
      const data = {
        nin: nin || undefined,
        typeOfId: typeOfId || undefined,
      };

      const _res = await fetch(`/api/v1/members/${item.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); if (!_res.ok) { const _json = await _res.json(); throw new Error(_json.error || "Update failed"); }
      toast.success("Identity information updated successfully");
    } catch (error) {
      toast.error("Failed to update identity information");
      console.error(error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Identity Information</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="grid gap-3">
            <Label htmlFor="nin">National ID Number (NIN)</Label>
            <Input
              id="nin"
              value={nin}
              onChange={(e) => setNin(e.target.value)}
              placeholder="Enter National ID Number"
              maxLength={14}
            />
          </div>

          <div className="grid gap-3">
            <Label htmlFor="typeOfId">Type of ID Used</Label>
            <Input
              id="typeOfId"
              value={typeOfId}
              onChange={(e) => setTypeOfId(e.target.value)}
              placeholder="e.g., National ID, Passport"
            />
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleUpdate} disabled={isUpdating}>
          {isUpdating ? "Updating..." : "Update Identity Information"}
        </Button>
      </CardFooter>
    </Card>
  );
}

function DocumentsCard({ item }: { item: Member & { user: any } }) {
  const [passportPhoto, setPassportPhoto] = useState(item.passportPhoto || "");
  const [idCopyPath, setIdCopyPath] = useState(item.idCopyPath || "");
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdate = async () => {
    setIsUpdating(true);

    try {
      const data = {
        passportPhoto: passportPhoto || undefined,
        idCopyPath: idCopyPath || undefined,
      };

      const _res = await fetch(`/api/v1/members/${item.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); if (!_res.ok) { const _json = await _res.json(); throw new Error(_json.error || "Update failed"); }
      toast.success("Documents updated successfully");
    } catch (error) {
      toast.error("Failed to update documents");
      console.error(error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Required Documents</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <Label>Passport Photo</Label>
              <p className="text-sm text-muted-foreground mb-3">
                Upload a recent passport-size photograph
              </p>
              {/* Uncomment when image upload component is available */}
              {/* <SingleImageInput
                title="Passport Photo"
                imageUrl={passportPhoto}
                setImageUrl={setPassportPhoto}
                endpoint="memberDocuments"
              /> */}
              <Input
                placeholder="Passport photo URL (temporary)"
                value={passportPhoto}
                onChange={(e) => setPassportPhoto(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label>National ID Copy</Label>
              <p className="text-sm text-muted-foreground mb-3">
                Upload a clear copy of your National ID
              </p>
              {/* Uncomment when image upload component is available */}
              {/* <SingleImageInput
                title="ID Copy"
                imageUrl={idCopyPath}
                setImageUrl={setIdCopyPath}
                endpoint="memberDocuments"
              /> */}
              <Input
                placeholder="ID copy URL (temporary)"
                value={idCopyPath}
                onChange={(e) => setIdCopyPath(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h4 className="font-medium text-amber-800 mb-2">
            Document Requirements:
          </h4>
          <ul className="text-sm text-amber-700 space-y-1">
            <li>• Two passport size photographs</li>
            <li>• Copy of National Identity Card is mandatory</li>
            <li>• Documents should be clear and legible</li>
            <li>• Photos should be recent (not older than 6 months)</li>
          </ul>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleUpdate} disabled={isUpdating}>
          {isUpdating ? "Updating..." : "Update Documents"}
        </Button>
      </CardFooter>
    </Card>
  );
}
