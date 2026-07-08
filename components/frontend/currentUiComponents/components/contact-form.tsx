"use client";

import type React from "react";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle } from "lucide-react";

export default function ContactForm() {
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real application, you would handle form submission here
    setIsSubmitted(true);
  };

  if (isSubmitted) {
    return (
      <div className="text-center p-8 bg-[#1e40af]/5 rounded-lg">
        <div className="mx-auto w-12 h-12 bg-[#1e40af]/10 rounded-full flex items-center justify-center mb-4">
          <CheckCircle className="h-6 w-6 text-[#1e40af] " />
        </div>
        <h3 className="text-xl font-semibold mb-2">Message Sent!</h3>
        <p className="text-slate-600 mb-4">
          Thank you for contacting BUTSACCO. We&apos;ve received your message
          and will get back to you as soon as possible.
        </p>
        <Button onClick={() => setIsSubmitted(false)}>
          Send Another Message
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="name">Full Name</Label>
          <Input id="name" placeholder="Enter your full name" required />
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
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Phone Number</Label>
        <Input id="phone" placeholder="Enter your phone number" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="subject">Subject</Label>
        <Select required>
          <SelectTrigger id="subject">
            <SelectValue placeholder="Select a subject" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="general">General Inquiry</SelectItem>
            <SelectItem value="membership">Membership Information</SelectItem>
            <SelectItem value="loans">Loan Information</SelectItem>
            <SelectItem value="savings">Savings Information</SelectItem>
            <SelectItem value="complaint">Complaint</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="message">Message</Label>
        <Textarea
          id="message"
          placeholder="Enter your message"
          rows={5}
          required
        />
      </div>

      <Button type="submit" className="w-full">
        Send Message
      </Button>
    </form>
  );
}
