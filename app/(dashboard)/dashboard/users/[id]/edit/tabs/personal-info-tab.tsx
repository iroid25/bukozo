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
import FormSelectInput from "@/components/FormInputs/FormSelectInput";
import { Option } from "../MemberUpdateForm";
import { Branch, Gender, MaritalStatus } from "@prisma/client";

export function PersonalInfoTab({ item }: { item: Member & { user: any } }) {
  return (
    <div className="grid gap-6 mt-6">
      <PersonalDetailsCard item={item} />
    </div>
  );
}

function PersonalDetailsCard({ item }: { item: Member & { user: any } }) {
  const [surname, setSurname] = useState(item.surname || "");
  const [otherNames, setOtherNames] = useState(item.otherNames || "");
  const [age, setAge] = useState(item.age?.toString() || "");
  const [gender, setGender] = useState(item.gender || Gender.MALE);
  const [maritalStatus, setMaritalStatus] = useState(
    item.maritalStatus || MaritalStatus.SINGLE
  );
  const [maritalOther, setMaritalOther] = useState(item.maritalOther || "");
  const [isUpdating, setIsUpdating] = useState(false);

  const genderOptions = [
    { label: "Male", value: Gender.MALE },
    { label: "Female", value: Gender.FEMALE },
    { label: "Other", value: Gender.OTHER },
  ];

  const maritalOptions = [
    { label: "Single", value: MaritalStatus.SINGLE },
    { label: "Married", value: MaritalStatus.MARRIED },
    { label: "Divorced", value: MaritalStatus.DIVORCED },
    { label: "Widowed", value: MaritalStatus.WIDOWED },
    { label: "Separated", value: MaritalStatus.SEPARATED },
    { label: "Other", value: MaritalStatus.OTHER },
  ];
  // const branchOptions = branches.map((item) => {
  //   return {
  //     label: item.name,
  //     value: item.id,
  //   };
  // });
  // const initialBranch =
  //   branchOptions.find((option) => option.value === item.user.branchId) ||
  //   branchOptions[0];
  // const [selectedBranch, setSelectedBranch] = useState<Option>(initialBranch);
  const defaultGender = genderOptions.find((opt) => opt.value === gender);
  const [selectedGender, setSelectedGender] = useState(defaultGender);
  const defaultMarital = maritalOptions.find(
    (opt) => opt.value === maritalStatus
  );
  const [selectedMarital, setSelectedMarital] = useState(defaultMarital);

  const handleUpdate = async () => {
    setIsUpdating(true);

    try {
      const data = {
        surname: surname || undefined,

        otherNames: otherNames || undefined,
        age: age ? parseInt(age) : undefined,
        gender,
        maritalStatus,
        maritalOther:
          maritalStatus === MaritalStatus.OTHER ? maritalOther : undefined,
      };

      const _res = await fetch(`/api/v1/members/${item.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); if (!_res.ok) { const _json = await _res.json(); throw new Error(_json.error || "Update failed"); }
      toast.success("Personal information updated successfully");
    } catch (error) {
      toast.error("Failed to update personal information");
      console.error(error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Personal Information</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="grid gap-3">
            <Label htmlFor="surname">Surname</Label>
            <Input
              id="surname"
              value={surname}
              onChange={(e) => setSurname(e.target.value)}
              placeholder="Enter surname"
            />
          </div>

          <div className="grid gap-3">
            <Label htmlFor="otherNames">Other Names</Label>
            <Input
              id="otherNames"
              value={otherNames}
              onChange={(e) => setOtherNames(e.target.value)}
              placeholder="Enter other names"
            />
          </div>

          <div className="grid gap-3">
            <Label htmlFor="age">Age</Label>
            <Input
              id="age"
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="Enter age"
            />
          </div>

          <div className="grid gap-3">
            <FormSelectInput
              label="Gender"
              options={genderOptions}
              option={selectedGender as Option}
              setOption={setSelectedGender}
            />
          </div>

          <div className="grid gap-3">
            <FormSelectInput
              label="Marital Status"
              options={maritalOptions}
              option={selectedMarital as Option}
              setOption={setSelectedMarital}
            />
          </div>
          {/* <FormSelectInput
            label="Branch *"
            options={branchOptions}
            option={selectedBranch as Option}
            setOption={setSelectedBranch}
            toolTipText="Add New Branch"
            href="/dashboard/branches"
          /> */}

          {maritalStatus === MaritalStatus.OTHER && (
            <div className="grid gap-3">
              <Label htmlFor="maritalOther">Specify Marital Status</Label>
              <Input
                id="maritalOther"
                value={maritalOther}
                onChange={(e) => setMaritalOther(e.target.value)}
                placeholder="Please specify"
              />
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleUpdate} disabled={isUpdating}>
          {isUpdating ? "Updating..." : "Update Personal Information"}
        </Button>
      </CardFooter>
    </Card>
  );
}
