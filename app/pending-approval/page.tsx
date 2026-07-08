import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, ArrowLeft } from "lucide-react";

export default function PendingApprovalPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100">
            <Clock className="h-8 w-8 text-yellow-600" />
          </div>
          <CardTitle className="text-2xl">Registration Pending</CardTitle>
          <CardDescription>
            Your account is currently under review.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">
            Thank you for registering with Bukonzo Teachers SACCO. Your application has been received and is waiting for approval by the administration.
          </p>
          <p className="mt-4 text-sm text-gray-500">
            You will be notified once your account has been approved. This process typically takes 24-48 hours.
          </p>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button asChild variant="outline">
            <Link href="/login">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Login
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
