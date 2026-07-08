"use client";

import { useState } from "react";
import { Loader2, AlertCircle, CheckCircle2, User, MapPin, Heart, Info, Phone } from "lucide-react";
import { useRouter } from "next/navigation";

interface ProfileFormProps {
  initialData: {
    surname?: string;
    otherNames?: string;
    email?: string;
    nin?: string;
    dateOfBirth?: string;
    gender?: string;
    maritalStatus?: string;
    occupation?: string;
    citizenship?: string;
    address?: string;
    phone?: string;
    nokName?: string;
    nokRelationship?: string;
    nokPhone?: string;
  };
}

export default function ProfileForm({ initialData }: ProfileFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{[key: string]: string[]}>({});
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFieldErrors({});

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    try {
      const res = await fetch("/api/profile/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (!res.ok) {
        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors);
        } else {
          setError(result.error || "Something went wrong.");
        }
      } else {
        setSuccess(true);
        setTimeout(() => {
          router.push(result.nextUrl || "/pending-approval");
          router.refresh();
        }, 1500);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to connect to the server.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full text-center space-y-6">
           <div className="relative w-20 h-20 mx-auto">
            <div className="absolute inset-0 bg-green-100 rounded-full animate-ping opacity-75"></div>
            <div className="relative w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-gray-900">Registration Complete!</h2>
          <p className="text-gray-500 text-lg">Redirecting you to your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        
        {/* Header Section */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-blue-100 rounded-2xl rotate-3 flex items-center justify-center mx-auto mb-6 shadow-sm">
            <Info className="w-8 h-8 text-blue-600 -rotate-3" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Complete Your Profile</h1>
          <p className="text-gray-600 mt-3 max-w-lg mx-auto">
            Please provide your full details to activate your account for transactions. This is a one-time requirement.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          {/* Error Banner */}
          {error && (
            <div className="p-4 bg-red-50 border-b border-red-100 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="divide-y divide-gray-100">
            
            {/* Section 1: Personal Information */}
            <div className="p-8 space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                  <User className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Personal Details</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label htmlFor="surname" className="text-sm font-medium text-gray-700">Surname <span className="text-red-500">*</span></label>
                  <input type="text" name="surname" id="surname" required className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none uppercase" placeholder="DOE" defaultValue={initialData.surname} />
                   {fieldErrors.surname && <p className="text-sm text-red-600">{fieldErrors.surname[0]}</p>}
                </div>

                <div className="space-y-2">
                  <label htmlFor="otherNames" className="text-sm font-medium text-gray-700">Other Names <span className="text-red-500">*</span></label>
                  <input type="text" name="otherNames" id="otherNames" required className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none uppercase" placeholder="JOHN" defaultValue={initialData.otherNames} />
                   {fieldErrors.otherNames && <p className="text-sm text-red-600">{fieldErrors.otherNames[0]}</p>}
                </div>

                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium text-gray-700">Email Address <span className="text-red-500">*</span></label>
                  <input type="email" name="email" id="email" required className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="john@example.com" defaultValue={initialData.email} />
                   {fieldErrors.email && <p className="text-sm text-red-600">{fieldErrors.email[0]}</p>}
                </div>

                <div className="space-y-2">
                  <label htmlFor="nin" className="text-sm font-medium text-gray-700">NIN <span className="text-red-500">*</span></label>
                  <input type="text" name="nin" id="nin" required minLength={5} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none uppercase" placeholder="CM..." defaultValue={initialData.nin} />
                   {fieldErrors.nin && <p className="text-sm text-red-600">{fieldErrors.nin[0]}</p>}
                </div>

                <div className="space-y-2">
                  <label htmlFor="dateOfBirth" className="text-sm font-medium text-gray-700">Date of Birth <span className="text-red-500">*</span></label>
                  <input type="date" name="dateOfBirth" id="dateOfBirth" required className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" defaultValue={initialData.dateOfBirth} />
                   {fieldErrors.dateOfBirth && <p className="text-sm text-red-600">{fieldErrors.dateOfBirth[0]}</p>}
                </div>

                <div className="space-y-2">
                  <label htmlFor="gender" className="text-sm font-medium text-gray-700">Gender <span className="text-red-500">*</span></label>
                  <select name="gender" id="gender" required className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white" defaultValue={initialData.gender || ""}>
                    <option value="">Select Gender</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                   {fieldErrors.gender && <p className="text-sm text-red-600">{fieldErrors.gender[0]}</p>}
                </div>

                 <div className="space-y-2">
                  <label htmlFor="maritalStatus" className="text-sm font-medium text-gray-700">Marital Status <span className="text-red-500">*</span></label>
                  <select name="maritalStatus" id="maritalStatus" required className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white" defaultValue={initialData.maritalStatus || ""}>
                    <option value="">Select Status</option>
                    <option value="SINGLE">Single</option>
                    <option value="MARRIED">Married</option>
                    <option value="DIVORCED">Divorced</option>
                    <option value="WIDOWED">Widowed</option>
                  </select>
                   {fieldErrors.maritalStatus && <p className="text-sm text-red-600">{fieldErrors.maritalStatus[0]}</p>}
                </div>

                <div className="space-y-2">
                  <label htmlFor="occupation" className="text-sm font-medium text-gray-700">Occupation</label>
                  <input type="text" name="occupation" id="occupation" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="e.g. Teacher" defaultValue={initialData.occupation} />
                </div>
                
                 <div className="space-y-2">
                  <label htmlFor="citizenship" className="text-sm font-medium text-gray-700">Citizenship</label>
                  <input type="text" name="citizenship" id="citizenship" defaultValue={initialData.citizenship || "Ugandan"} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>
            </div>

            {/* Section 2: Address & Contact */}
            <div className="p-8 space-y-6 bg-gray-50/50">
               <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-indigo-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Address & Contact</h3>
              </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-2 md:col-span-2">
                  <label htmlFor="address" className="text-sm font-medium text-gray-700">Current Residential Address <span className="text-red-500">*</span></label>
                  <input type="text" name="address" id="address" required className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Village, Parish, Sub-county, District" defaultValue={initialData.address} />
                </div>
                 <div className="space-y-2">
                  <label htmlFor="phone" className="text-sm font-medium text-gray-700">Alternative Phone (Optional)</label>
                  <input type="tel" name="phone" id="phone" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="+256..." defaultValue={initialData.phone} />
                </div>
               </div>
            </div>

            {/* Section 3: Next of Kin */}
            <div className="p-8 space-y-6">
               <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center">
                  <Heart className="w-5 h-5 text-rose-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Next of Kin</h3>
              </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-2">
                  <label htmlFor="nokName" className="text-sm font-medium text-gray-700">Full Name <span className="text-red-500">*</span></label>
                  <input type="text" name="nokName" id="nokName" required className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none uppercase" defaultValue={initialData.nokName} />
                   {fieldErrors.nokName && <p className="text-sm text-red-600">{fieldErrors.nokName[0]}</p>}
                </div>

                <div className="space-y-2">
                  <label htmlFor="nokRelationship" className="text-sm font-medium text-gray-700">Relationship <span className="text-red-500">*</span></label>
                   <select name="nokRelationship" id="nokRelationship" required className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white" defaultValue={initialData.nokRelationship || ""}>
                    <option value="">Select Relationship</option>
                    <option value="SPOUSE">Spouse</option>
                    <option value="CHILD">Child</option>
                    <option value="PARENT">Parent</option>
                    <option value="SIBLING">Sibling</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                 <div className="space-y-2">
                  <label htmlFor="nokPhone" className="text-sm font-medium text-gray-700">Phone Number <span className="text-red-500">*</span></label>
                  <input type="tel" name="nokPhone" id="nokPhone" required className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="+256..." defaultValue={initialData.nokPhone} />
                   {fieldErrors.nokPhone && <p className="text-sm text-red-600">{fieldErrors.nokPhone[0]}</p>}
                </div>
               </div>
            </div>

            <div className="p-8 bg-gray-50 rounded-b-2xl border-t border-gray-100">
               <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform active:scale-95 duration-200"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Updating Information...
                    </>
                  ) : (
                    "Complete Profile Registration"
                  )}
                </button>
              <p className="text-xs text-center text-gray-500 mt-4">By clicking Complete Registration, you certify that the information provided is accurate and true.</p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
