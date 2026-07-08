// @ts-nocheck
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

import type { Member } from "@/types/member";
import FormSelectInput from "@/components/FormInputs/FormSelectInput";

import { Option } from "../MemberUpdateForm";

const OtherSaccosCount = {
  NONE: "NONE",
  ONE: "ONE",
  MANY: "MANY",
} as const;

const FinancialDiscipline = {
  EXCELLENT: "EXCELLENT",
  NORMAL: "NORMAL",
  WANTING: "WANTING",
} as const;

export function RecommendationTab({ item }: { item: Member & { user: any } }) {
  return (
    <div className="grid gap-6 mt-7">
      <ApplicantDetailsCard item={item} />
      <RecommenderDetailsCard item={item} />
    </div>
  );
}

function ApplicantDetailsCard({ item }: { item: Member & { user: any } }) {
  const [applicantOccupationLC, setApplicantOccupationLC] = useState(
    item.applicantOccupationLC || ""
  );
  const [designationLC, setDesignationLC] = useState(item.designationLC || "");
  const [locationLC, setLocationLC] = useState(item.locationLC || "");
  const [otherSaccosCount, setOtherSaccosCount] = useState(
    item.otherSaccosCount || OtherSaccosCount.NONE
  );
  const [financialDiscipline, setFinancialDiscipline] = useState(
    item.financialDiscipline || FinancialDiscipline.NORMAL
  );
  const [isUpdating, setIsUpdating] = useState(false);

  const saccosCountOptions = [
    { label: "None", value: OtherSaccosCount.NONE },
    { label: "One", value: OtherSaccosCount.ONE },
    { label: "Many", value: OtherSaccosCount.MANY },
  ];

  const disciplineOptions = [
    { label: "Excellent", value: FinancialDiscipline.EXCELLENT },
    { label: "Normal", value: FinancialDiscipline.NORMAL },
    { label: "Wanting", value: FinancialDiscipline.WANTING },
  ];

  const defaultSaccosCount = saccosCountOptions.find(
    (opt) => opt.value === otherSaccosCount
  );
  const defaultDiscipline = disciplineOptions.find(
    (opt) => opt.value === financialDiscipline
  );
  const [selectedDiscipline, setSelectedDiscipline] =
    useState(defaultDiscipline);
  const [selectedSaccosCount, setSelectedSaccosCount] =
    useState(defaultSaccosCount);

  const handleUpdate = async () => {
    setIsUpdating(true);

    try {
      const data = {
        applicantOccupationLC: applicantOccupationLC || undefined,
        designationLC: designationLC || undefined,
        locationLC: locationLC || undefined,
        otherSaccosCount,
        financialDiscipline,
      };

      const _res = await fetch(`/api/v1/members/${item.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); if (!_res.ok) { const _json = await _res.json(); throw new Error(_json.error || "Update failed"); }
      toast.success("Applicant details updated successfully");
    } catch (error) {
      toast.error("Failed to update applicant details");
      console.error(error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          LC/Head of Institution Recommendation - Applicant Details
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="grid gap-3">
            <Label htmlFor="applicantOccupationLC">Applicant Occupation</Label>
            <Input
              id="applicantOccupationLC"
              value={applicantOccupationLC}
              onChange={(e) => setApplicantOccupationLC(e.target.value)}
              placeholder="As known by LC/Head"
            />
          </div>

          <div className="grid gap-3">
            <Label htmlFor="designationLC">Designation</Label>
            <Input
              id="designationLC"
              value={designationLC}
              onChange={(e) => setDesignationLC(e.target.value)}
              placeholder="Job designation"
            />
          </div>

          <div className="grid gap-3">
            <Label htmlFor="locationLC">Location of Applicant</Label>
            <Input
              id="locationLC"
              value={locationLC}
              onChange={(e) => setLocationLC(e.target.value)}
              placeholder="Where applicant is located"
            />
          </div>

          <div className="grid gap-3">
            <FormSelectInput
              label="Number of Other SACCOs/Financial Institutions"
              options={saccosCountOptions}
              option={selectedSaccosCount as Option}
              setOption={setSelectedSaccosCount}
            />
          </div>

          <div className="grid gap-3">
            <FormSelectInput
              label="Financial Discipline Rating"
              options={disciplineOptions}
              option={selectedDiscipline as Option}
              setOption={setSelectedDiscipline}
            />
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="font-medium text-green-800 mb-2">
            LC/Head of Institution Certification:
          </h4>
          <p className="text-sm text-green-700">
            "I certify that the person named above is a true citizen/employee of
            this village/institution and the information given about him/her
            above is correct to the best of my knowledge."
          </p>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleUpdate} disabled={isUpdating}>
          {isUpdating ? "Updating..." : "Update Applicant Details"}
        </Button>
      </CardFooter>
    </Card>
  );
}

function RecommenderDetailsCard({ item }: { item: Member & { user: any } }) {
  const [recommenderName, setRecommenderName] = useState(
    item.recommenderName || ""
  );
  const [recommenderTitle, setRecommenderTitle] = useState(
    item.recommenderTitle || ""
  );
  const [recommenderPhone, setRecommenderPhone] = useState(
    item.recommenderPhone || ""
  );
  const [recommendationDate, setRecommendationDate] = useState(
    item.recommendationDate
      ? new Date(item.recommendationDate).toISOString().split("T")[0]
      : ""
  );
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdate = async () => {
    setIsUpdating(true);

    try {
      const data = {
        recommenderName: recommenderName || undefined,
        recommenderTitle: recommenderTitle || undefined,
        recommenderPhone: recommenderPhone || undefined,
        recommendationDate: recommendationDate
          ? new Date(recommendationDate)
          : undefined,
      };

      const _res = await fetch(`/api/v1/members/${item.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); if (!_res.ok) { const _json = await _res.json(); throw new Error(_json.error || "Update failed"); }
      toast.success("Recommender details updated successfully");
    } catch (error) {
      toast.error("Failed to update recommender details");
      console.error(error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recommender Information</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="grid gap-3">
            <Label htmlFor="recommenderName">Recommender Name</Label>
            <Input
              id="recommenderName"
              value={recommenderName}
              onChange={(e) => setRecommenderName(e.target.value)}
              placeholder="Full name of recommender"
            />
          </div>

          <div className="grid gap-3">
            <Label htmlFor="recommenderTitle">Title/Position</Label>
            <Input
              id="recommenderTitle"
              value={recommenderTitle}
              onChange={(e) => setRecommenderTitle(e.target.value)}
              placeholder="e.g., LC Chairman, Head Teacher"
            />
          </div>

          <div className="grid gap-3">
            <Label htmlFor="recommenderPhone">Phone Number</Label>
            <Input
              id="recommenderPhone"
              type="tel"
              value={recommenderPhone}
              onChange={(e) => setRecommenderPhone(e.target.value)}
              placeholder="Recommender's phone"
            />
          </div>

          <div className="grid gap-3">
            <Label htmlFor="recommendationDate">Recommendation Date</Label>
            <Input
              id="recommendationDate"
              type="date"
              value={recommendationDate}
              onChange={(e) => setRecommendationDate(e.target.value)}
            />
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h4 className="font-medium text-amber-800 mb-2">Required:</h4>
          <p className="text-sm text-amber-700">
            Official stamp is necessary for this recommendation to be valid.
          </p>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleUpdate} disabled={isUpdating}>
          {isUpdating ? "Updating..." : "Update Recommender Information"}
        </Button>
      </CardFooter>
    </Card>
  );
}
