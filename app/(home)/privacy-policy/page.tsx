import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPolicyPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="bg-slate-50 py-12">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl font-bold mb-4">Privacy Policy</h1>
          <p className="text-lg text-slate-600 max-w-3xl">
            Our commitment to protecting your personal information and privacy.
          </p>
        </div>
      </section>

      {/* Privacy Policy Content */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="prose prose-slate max-w-none">
              <p>
                This page outlines the privacy policy of our website. We are
                committed to protecting your privacy and ensuring that your
                personal information is handled in a safe and responsible
                manner.
              </p>

              <p>
                Please read our privacy policy carefully to understand how we
                collect, use, and protect your personal information.
              </p>

              <h2 className="text-2xl font-semibold mt-8 mb-4">
                Information We Collect
              </h2>

              <p>We may collect the following types of information:</p>

              <ul className="space-y-2 mb-6">
                <li>
                  <strong>Personal Information:</strong> This includes your
                  name, email address, phone number, physical address, and other
                  contact details you provide to us.
                </li>
                <li>
                  <strong>Financial Information:</strong> When you apply for
                  membership or services, we may collect information about your
                  financial status, income, employment, and related details.
                </li>
                <li>
                  <strong>Identification Information:</strong> We may collect
                  copies of identification documents such as national ID,
                  passport, or driver&apos;s license.
                </li>
                <li>
                  <strong>Website Usage Data:</strong> We collect information
                  about your interactions with our website, including IP
                  address, browser type, pages visited, and time spent on the
                  site.
                </li>
              </ul>

              <h2 className="text-2xl font-semibold mt-8 mb-4">
                How We Use Your Information
              </h2>

              <p>
                We use the information we collect for the following purposes:
              </p>

              <ul className="space-y-2 mb-6">
                <li>To provide and maintain our services</li>
                <li>
                  To process your membership application and service requests
                </li>
                <li>To communicate with you about your account and services</li>
                <li>
                  To provide customer support and respond to your inquiries
                </li>
                <li>To improve our website and services</li>
                <li>To comply with legal and regulatory requirements</li>
                <li>To detect and prevent fraudulent activities</li>
              </ul>

              <h2 className="text-2xl font-semibold mt-8 mb-4">
                Data Protection
              </h2>

              <p>
                We implement appropriate security measures to protect your
                personal information from unauthorized access, alteration,
                disclosure, or destruction. These measures include:
              </p>

              <ul className="space-y-2 mb-6">
                <li>Secure storage of physical documents</li>
                <li>Encryption of digital information</li>
                <li>Access controls for our staff and systems</li>
                <li>Regular security assessments and updates</li>
              </ul>

              <h2 className="text-2xl font-semibold mt-8 mb-4">
                Information Sharing
              </h2>

              <p>
                We do not sell, trade, or rent your personal information to
                third parties. We may share your information in the following
                circumstances:
              </p>

              <ul className="space-y-2 mb-6">
                <li>
                  With service providers who help us operate our business and
                  website
                </li>
                <li>With regulatory authorities when required by law</li>
                <li>With credit reference bureaus for loan processing</li>
                <li>With your consent for specific purposes</li>
              </ul>

              <h2 className="text-2xl font-semibold mt-8 mb-4">Your Rights</h2>

              <p>You have the right to:</p>

              <ul className="space-y-2 mb-6">
                <li>Access the personal information we hold about you</li>
                <li>Request correction of inaccurate information</li>
                <li>
                  Request deletion of your information (subject to legal
                  requirements)
                </li>
                <li>Object to certain processing of your information</li>
                <li>Withdraw consent where processing is based on consent</li>
              </ul>

              <h2 className="text-2xl font-semibold mt-8 mb-4">
                Changes to This Policy
              </h2>

              <p>
                We may update our Privacy Policy from time to time. We will
                notify you of any changes by posting the new Privacy Policy on
                this page and updating the &ldquo;Last Updated&rdquo; date.
              </p>

              <h2 className="text-2xl font-semibold mt-8 mb-4">Contact Us</h2>

              <p>
                If you have any questions about this Privacy Policy, please
                contact us at:
              </p>

              <ul className="space-y-2 mb-6">
                <li>Email: bukonzounitedteacherssacco@gmail.com</li>
                <li>Phone: +256788 566925</li>
                <li>
                  Address: Plot 2 Main Street, Kisinga Bwera Road, Kisinga,
                  Uganda
                </li>
              </ul>

              <p className="text-sm text-slate-500 mt-8">
                Last Updated: March 1, 2023
              </p>
            </div>

            <div className="mt-12">
              <Button asChild variant="outline">
                <Link href="/">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* About BUTSACCO Section */}
      <section className="py-12 bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-6">
              bukonzoUnited TEACHERS SACCO
            </h2>
            <p className="mb-6">
              Providing exceptional financial services with compassion and
              expertise since 2009. Our commitment to excellence has made us a
              trusted financial provider in the community.
            </p>

            <div className="grid md:grid-cols-2 gap-8 mt-8">
              <div>
                <h3 className="text-xl font-semibold mb-4">Our Mission</h3>
                <p>
                  To provide accessible, high-quality financial services that
                  improve the wealth and well-being of our community through
                  affordable loans, agent banking and mobile money services and
                  continuous innovation.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-4">Our Vision</h3>
                <p>
                  To be the leading financial institution in the region,
                  recognized for our commitment to member satisfaction,
                  community development, and financial inclusion.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
