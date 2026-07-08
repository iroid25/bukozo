"use client";

import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle } from "lucide-react";

export default function MembershipForm() {
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real application, you would handle form submission here
    setIsSubmitted(true);
  };

  if (isSubmitted) {
    return (
      <div className="text-center p-8bg-[#1e40af]/5 rounded-lg">
        <div className="mx-auto w-12 h-12bg-[#1e40af]/10 rounded-full flex items-center justify-center mb-4">
          <CheckCircle className="h-6 w-6 text-primary" />
        </div>
        <h3 className="text-xl font-semibold mb-2">Application Submitted!</h3>
        <p className="text-slate-600 mb-4">
          Thank you for your interest in joining BUTSACCO. We&apos;ve received
          your application and will contact you within 2 business days.
        </p>
        <Button onClick={() => setIsSubmitted(false)}>
          Submit Another Application
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="firstName">First Name</Label>
          <Input id="firstName" placeholder="Enter your first name" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last Name</Label>
          <Input id="lastName" placeholder="Enter your last name" required />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email Address</Label>
        <Input
          id="email"
          type="email"
          placeholder="Enter your email address"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Phone Number</Label>
        <Input id="phone" placeholder="Enter your phone number" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Physical Address</Label>
        <Textarea
          id="address"
          placeholder="Enter your physical address"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="occupation">Occupation</Label>
        <Input id="occupation" placeholder="Enter your occupation" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="idType">ID Type</Label>
        <Select required>
          <SelectTrigger id="idType">
            <SelectValue placeholder="Select ID type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="national">National ID</SelectItem>
            <SelectItem value="passport">Passport</SelectItem>
            <SelectItem value="drivers">Driver&apos;s License</SelectItem>
            <SelectItem value="voter">Voter&apos;s Card</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="idNumber">ID Number</Label>
        <Input id="idNumber" placeholder="Enter your ID number" required />
      </div>

      <div className="space-y-2">
        <Label>Are you a teacher?</Label>
        <RadioGroup defaultValue="no" className="flex space-x-4">
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="yes" id="teacher-yes" />
            <Label htmlFor="teacher-yes">Yes</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="no" id="teacher-no" />
            <Label htmlFor="teacher-no">No</Label>
          </div>
        </RadioGroup>
      </div>

      <div className="space-y-2">
        <Label>How did you hear about us?</Label>
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="friend">Friend or Family</SelectItem>
            <SelectItem value="social">Social Media</SelectItem>
            <SelectItem value="radio">Radio</SelectItem>
            <SelectItem value="newspaper">Newspaper</SelectItem>
            <SelectItem value="event">Community Event</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button type="submit" className="w-full">
        Submit Application
      </Button>
    </form>
  );
}
