
import { authOptions } from "@/config/auth";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import ChangePasswordForm from "@/components/Forms/ChangePasswordForm";

export default async function ForcePasswordChangePage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  if (!session.user.requiresPasswordChange) {
    redirect("/dashboard");
  }

  return (
    <div className="h-screen w-full flex items-center justify-center bg-slate-50 p-4 overflow-hidden">
      <div className="max-w-5xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row h-[600px] max-h-[90vh]">
        {/* Left Section - Visuals & Context */}
        <div className="w-full md:w-5/12 bg-slate-900 p-8 md:p-12 flex flex-col justify-between text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-20" />
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 opacity-90" />
          
          <div className="relative z-10">
            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-sm border border-white/20 mb-6">
               <svg 
                xmlns="http://www.w3.org/2000/svg" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                className="w-6 h-6 text-white"
              >
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold mb-4">Security Update Required</h1>
            <p className="text-slate-300 leading-relaxed">
              To ensure the security of your account and our banking systems, you are required to update your temporary password.
            </p>
          </div>

          <div className="relative z-10 mt-auto">
             <div className="flex items-center gap-4 text-sm text-slate-400">
                <div className="flex items-center gap-2">
                   <div className="w-2 h-2 rounded-full bg-green-500" />
                   <span>Secure Connection</span>
                </div>
                <div className="flex items-center gap-2">
                   <div className="w-2 h-2 rounded-full bg-blue-500" />
                   <span>End-to-End Encrypted</span>
                </div>
             </div>
             <p className="mt-6 text-xs text-slate-500">
               Bukonzo Teachers SACCO &copy; {new Date().getFullYear()}
             </p>
          </div>
        </div>
        
        {/* Right Section - Form */}
        <div className="w-full md:w-7/12 p-8 md:p-12 bg-white flex flex-col justify-center overflow-y-auto">
          <div className="max-w-md mx-auto w-full">
            <div className="mb-8">
               <h2 className="text-2xl font-bold text-slate-900">Set New Password</h2>
               <p className="text-slate-500 mt-1">Create a strong, unique password for your account.</p>
            </div>
            
            <ChangePasswordForm 
              editingId={session.user.id} 
              initialData={null} 
            />
          </div>
        </div>
      </div>
    </div>
  );
}
