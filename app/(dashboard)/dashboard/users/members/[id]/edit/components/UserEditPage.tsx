// "use client";
// import React, { useState, useRef, useEffect } from "react";
// import {
//   Dialog,
//   DialogContent,
//   DialogDescription,
//   DialogFooter,
//   DialogHeader,
//   DialogTitle,
// } from "@/components/ui/dialog";
// import {
//   User,
//   Phone,
//   Mail,
//   Calendar,
//   CreditCard,
//   Lock,
//   Camera,
//   Upload,
//   X,
//   Eye,
//   EyeOff,
// } from "lucide-react";
// import { useForm } from "react-hook-form";
// import { Button } from "@/components/ui/button";
// import TextInput from "@/components/FormInputs/TextInput";
// import { UserCreateDTO } from "@/types/user";
// import { toast } from "sonner";
// import { useRouter } from "next/navigation";
// import { Branch } from "@prisma/client";
// import FormSelectInput from "@/components/FormInputs/FormSelectInput";
// import { useUploadThing } from "@/lib/uploadthing";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";

// type Option = {
//   label: string;
//   value: string;
// };

// export default function UserCreateForm({
//   initialData,
//   editingId,
//   isOpen,
//   onClose,
//   branchId,
//   role,
//   branches,
// }: {
//   initialData?: Partial<UserCreateDTO>;
//   editingId?: string;
//   isOpen: boolean;
//   onClose: () => void;
//   branchId?: string;
//   role?: string;
//   branches: Branch[];
// }) {
//   const {
//     register,
//     handleSubmit,
//     reset,
//     formState: { errors },
//     watch,
//     setValue,
//   } = useForm<UserCreateDTO>({
//     defaultValues: {
//       firstName: initialData?.firstName || "",
//       lastName: initialData?.lastName || "",
//       phone: initialData?.phone || "",
//       email: initialData?.email || "",
//       nationalId: initialData?.nationalId || "",
//       password: `Password@${new Date().getFullYear()}`,
//       jobTitle: initialData?.jobTitle || "",
//       image: initialData?.image || "",
//     },
//   });

//   const [loading, setLoading] = useState(false);
//   const [showPassword, setShowPassword] = useState(false);
//   const [isDragging, setIsDragging] = useState(false);
//   const [imageUrl, setImageUrl] = useState<string>(initialData?.image || "");
//   const [isCameraOpen, setIsCameraOpen] = useState(false);
//   const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
//   const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
//   const [phone, setPhone] = useState("+256 ");

//   const router = useRouter();
//   const userRole = role?.toUpperCase();
//   const videoRef = useRef<HTMLVideoElement>(null);
//   const fileInputRef = useRef<HTMLInputElement>(null);

//   // ✅ FIXED: Proper callback handling
//   const { startUpload, isUploading } = useUploadThing("userProfileImage", {
//     onClientUploadComplete: (res) => {
//       console.log("✅ Client upload complete:", res);
//       if (res && res.length > 0 && res[0]?.url) {
//         const uploadedUrl = res[0].url;
//         console.log("📸 Setting image URL:", uploadedUrl);
//         setImageUrl(uploadedUrl);
//         setValue("image", uploadedUrl);
//         toast.success("Photo uploaded successfully!");
//       } else {
//         console.error("❌ No URL in response:", res);
//         toast.error("Upload completed but no URL returned");
//       }
//     },
//     onUploadError: (error) => {
//       console.error("❌ Upload error:", error);
//       toast.error(`Upload failed: ${error.message}`);
//     },
//     onUploadBegin: (fileName) => {
//       console.log("📤 Upload begin:", fileName);
//       toast.info("Uploading...");
//     },
//   });

//   const getRoleDisplayName = () => {
//     switch (role?.toUpperCase()) {
//       case "ADMIN":
//         return { name: "Administrator", path: "admin" };
//       case "BRANCHMANAGER":
//         return { name: "Branch Manager", path: "managers" };
//       case "TELLER":
//         return { name: "Teller", path: "tellers" };
//       case "AGENT":
//         return { name: "Agent", path: "agents" };
//       case "MEMBER":
//         return { name: "Member", path: "members" };
//       case "ACCOUNTANT":
//         return { name: "Accountant", path: "accountants" };
//       case "LOANOFFICER":
//         return { name: "Loan Officer", path: "loan-officers" };
//       case "AUDITOR":
//         return { name: "Auditor", path: "auditors" };
//       default:
//         return { name: "User", path: "users" };
//     }
//   };

//   const branchOptions = branches.map((item) => ({
//     label: item.name,
//     value: item.id,
//   }));

//   const [selectedBranch, setSelectedBranch] = useState<Option>(
//     branchOptions[0] || { label: "No Branch", value: "" }
//   );

//   const openCamera = async () => {
//     try {
//       const stream = await navigator.mediaDevices.getUserMedia({
//         video: {
//           facingMode: "user",
//           width: { ideal: 1280 },
//           height: { ideal: 720 },
//         },
//       });

//       setCameraStream(stream);
//       setIsCameraOpen(true);
//       setCapturedPreview(null);

//       setTimeout(() => {
//         if (videoRef.current) {
//           videoRef.current.srcObject = stream;
//           videoRef.current.play().catch((err) => {
//             console.error("Error playing video:", err);
//             toast.error("Failed to start video stream");
//           });
//         }
//       }, 100);
//     } catch (error) {
//       console.error("Error accessing camera:", error);
//       toast.error("Unable to access camera. Please check permissions.");
//     }
//   };

//   const closeCamera = () => {
//     if (cameraStream) {
//       cameraStream.getTracks().forEach((track) => track.stop());
//       setCameraStream(null);
//     }
//     if (videoRef.current) {
//       videoRef.current.srcObject = null;
//     }
//     setIsCameraOpen(false);
//     setCapturedPreview(null);
//   };

//   const capturePhoto = () => {
//     if (!videoRef.current) return;

//     const canvas = document.createElement("canvas");
//     canvas.width = videoRef.current.videoWidth;
//     canvas.height = videoRef.current.videoHeight;

//     const ctx = canvas.getContext("2d");
//     if (!ctx) return;

//     ctx.drawImage(videoRef.current, 0, 0);
//     const base64Image = canvas.toDataURL("image/jpeg", 0.9);

//     setCapturedPreview(base64Image);
//   };

//   // ✅ FIXED: Better error handling for captured images
//   const uploadCapturedImage = async (base64Image: string) => {
//     try {
//       console.log("📷 Converting captured image to file...");
//       const response = await fetch(base64Image);
//       const blob = await response.blob();

//       console.log("📦 Blob size:", blob.size, "bytes");
//       console.log("📦 Blob type:", blob.type);

//       const fileName = `user_profile_${Date.now()}.jpg`;
//       const file = new File([blob], fileName, { type: "image/jpeg" });

//       console.log("📤 Starting upload for:", fileName);
//       const res = await startUpload([file]);

//       console.log("📥 Upload response:", res);

//       if (res && res.length > 0 && res[0]?.url) {
//         console.log("✅ Camera upload successful");
//         closeCamera();
//       } else {
//         console.error("❌ No URL in camera upload response");
//         toast.error("Upload completed but no URL returned");
//       }
//     } catch (error: any) {
//       console.error("❌ Camera upload error:", error);
//       toast.error(`Upload failed: ${error.message || "Unknown error"}`);
//     }
//   };

//   // ✅ FIXED: Better validation and error handling
//   const handleFileSelect = async (file: File) => {
//     if (!file) {
//       console.log("⚠️ No file selected");
//       return;
//     }

//     console.log("📁 File selected:", {
//       name: file.name,
//       size: file.size,
//       type: file.type,
//     });

//     // Validate file size
//     if (file.size > 2 * 1024 * 1024) {
//       toast.error("File size must be less than 2MB");
//       console.error("❌ File too large:", file.size, "bytes");
//       return;
//     }

//     // Validate file type
//     const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
//     if (!validTypes.includes(file.type)) {
//       toast.error("Only JPG, JPEG, PNG, and WEBP files are allowed");
//       console.error("❌ Invalid file type:", file.type);
//       return;
//     }

//     console.log("✅ File validation passed, starting upload...");

//     try {
//       const res = await startUpload([file]);
//       console.log("📥 File upload response:", res);

//       if (!res || res.length === 0) {
//         console.error("❌ Empty upload response");
//         toast.error("Upload failed - no response from server");
//       }
//     } catch (error: any) {
//       console.error("❌ File upload error:", error);
//       toast.error(`Upload failed: ${error.message || "Unknown error"}`);
//     }
//   };

//   const handleDrop = (e: React.DragEvent) => {
//     e.preventDefault();
//     setIsDragging(false);
//     const files = Array.from(e.dataTransfer.files);
//     console.log("📂 Files dropped:", files.length);
//     if (files.length > 0) {
//       handleFileSelect(files[0]);
//     }
//   };

//   const handleDragOver = (e: React.DragEvent) => {
//     e.preventDefault();
//     setIsDragging(true);
//   };

//   const handleDragLeave = (e: React.DragEvent) => {
//     e.preventDefault();
//     setIsDragging(false);
//   };

//   const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     let value = e.target.value;
//     if (!value.startsWith("+256")) {
//       value = "+256 ";
//     }
//     setPhone(value);
//   };

//   useEffect(() => {
//     return () => {
//       if (cameraStream) {
//         cameraStream.getTracks().forEach((track) => track.stop());
//       }
//     };
//   }, [cameraStream]);

//   useEffect(() => {
//     if (!isOpen) {
//       closeCamera();
//     }
//   }, [isOpen]);

//   useEffect(() => {
//     if (editingId && initialData) {
//       Object.keys(initialData).forEach((key) => {
//         setValue(
//           key as keyof UserCreateDTO,
//           initialData[key as keyof UserCreateDTO]
//         );
//       });
//       setImageUrl(initialData.image || "");
//       if (initialData.phone) {
//         setPhone(initialData.phone);
//       }
//     }
//   }, [editingId, initialData, setValue]);

//   async function saveUser(data: UserCreateDTO) {
//     try {
//       setLoading(true);

//       if (!editingId && !data.password) {
//         toast.error("Password is required");
//         setLoading(false);
//         return;
//       }

//       if (!data.lastName) {
//         toast.error("Last Name is required");
//         setLoading(false);
//         return;
//       }

//       if (!data.email) {
//         toast.error("Email Address is required");
//         setLoading(false);
//         return;
//       }

//       if (!selectedBranch.value) {
//         toast.error("Please select a branch");
//         setLoading(false);
//         return;
//       }

//       const name = `${data.firstName || ""} ${data.lastName}`.trim();

//       const payload = {
//         firstName: data.firstName || "",
//         lastName: data.lastName,
//         email: data.email,
//         password: data.password || `Password@${new Date().getFullYear()}`,
//         name: name,
//         phone: phone || null,
//         dateOfBirth: data.dateOfBirth || null,
//         nationalId: data.nationalId || null,
//         jobTitle: data.jobTitle || null,
//         branchId: selectedBranch.value,
//         role: role?.toUpperCase() || "MEMBER",
//         areaOfOperation: data.areaOfOperation || null,
//         image: imageUrl || null,
//         address: data.address || null,
//       };

//       const endpoint = `/api/v1/users`;
//       const method = editingId ? "PUT" : "POST";
//       const bodyData = editingId ? { ...payload, userId: editingId } : payload;

//       const response = await fetch(endpoint, {
//         method,
//         headers: {
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify(bodyData),
//       });

//       const result = await response.json();

//       if (!response.ok) {
//         toast.error(
//           editingId ? "Failed to Update User" : "Failed to Create User",
//           {
//             description: result.error || "Something went wrong",
//           }
//         );
//         setLoading(false);
//         return;
//       }

//       setLoading(false);
//       toast.success(
//         editingId ? "User Updated Successfully!" : "User Created Successfully!",
//         {
//           description: editingId
//             ? "Changes have been saved"
//             : "Registration email sent",
//         }
//       );
//       reset();
//       setImageUrl("");
//       onClose();
//       router.refresh();
//     } catch (error: any) {
//       console.error("❌ ERROR:", error);
//       toast.error("Something went wrong", {
//         description: error.message || "Please try again",
//       });
//       setLoading(false);
//     }
//   }

//   return (
//     <Dialog
//       open={isOpen}
//       onOpenChange={(open) => {
//         if (!open) {
//           reset();
//           setImageUrl("");
//           onClose();
//         }
//       }}
//     >
//       <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
//         <DialogHeader>
//           <DialogTitle>
//             {editingId
//               ? `Edit ${getRoleDisplayName().name}`
//               : `Add New ${getRoleDisplayName().name}`}
//           </DialogTitle>
//           <DialogDescription>
//             Fill in the {getRoleDisplayName().name.toLowerCase()} information
//             below. Fields marked with * are required.
//           </DialogDescription>
//         </DialogHeader>

//         <form
//           onSubmit={handleSubmit(saveUser)}
//           className="flex-1 overflow-y-auto"
//         >
//           <div className="space-y-6 p-1">
//             <div className="space-y-4">
//               <h3 className="text-lg font-semibold flex items-center gap-2">
//                 <User className="h-5 w-5" />
//                 Profile Photo
//               </h3>

//               <div className="flex justify-center">
//                 <div className="space-y-3 w-full max-w-md">
//                   <div
//                     className={`w-full aspect-video rounded-lg border-2 border-dashed flex items-center justify-center transition-colors ${
//                       isDragging
//                         ? "border-primary bg-primary/5"
//                         : "border-muted-foreground/25 hover:border-primary/50"
//                     } ${isUploading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
//                     onDrop={handleDrop}
//                     onDragOver={handleDragOver}
//                     onDragLeave={handleDragLeave}
//                     onClick={() => {
//                       if (!isUploading) {
//                         fileInputRef.current?.click();
//                       }
//                     }}
//                   >
//                     {imageUrl ? (
//                       <div className="relative w-full h-full">
//                         <img
//                           src={imageUrl}
//                           alt="Profile preview"
//                           className="w-full h-full object-cover rounded-lg"
//                         />
//                         <button
//                           type="button"
//                           onClick={(e) => {
//                             e.stopPropagation();
//                             setImageUrl("");
//                             setValue("image", "");
//                             toast.success("Photo removed");
//                           }}
//                           className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full p-2 shadow-lg hover:bg-destructive/90"
//                           disabled={isUploading}
//                         >
//                           <X className="h-4 w-4" />
//                         </button>
//                       </div>
//                     ) : (
//                       <div className="text-center p-8">
//                         <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
//                         <p className="text-sm font-medium text-muted-foreground mb-1">
//                           {isUploading
//                             ? "Uploading..."
//                             : "Drop photo here or click to browse"}
//                         </p>
//                         <p className="text-xs text-muted-foreground">
//                           JPG, PNG up to 2MB
//                         </p>
//                       </div>
//                     )}
//                   </div>

//                   <div className="flex gap-2">
//                     <Button
//                       type="button"
//                       variant="outline"
//                       size="sm"
//                       onClick={() => fileInputRef.current?.click()}
//                       disabled={isUploading}
//                       className="flex-1"
//                     >
//                       <Upload className="h-4 w-4 mr-2" />
//                       {imageUrl ? "Change Photo" : "Upload File"}
//                     </Button>
//                     <Button
//                       type="button"
//                       variant="outline"
//                       size="sm"
//                       onClick={openCamera}
//                       disabled={isUploading}
//                       className="flex-1"
//                     >
//                       <Camera className="h-4 w-4 mr-2" />
//                       Open Camera
//                     </Button>
//                   </div>

//                   <input
//                     ref={fileInputRef}
//                     type="file"
//                     accept="image/*"
//                     onChange={(e) => {
//                       const file = e.target.files?.[0];
//                       if (file) {
//                         handleFileSelect(file);
//                       }
//                     }}
//                     className="hidden"
//                     disabled={isUploading}
//                   />
//                 </div>
//               </div>
//             </div>

//             <div className="space-y-4">
//               <h3 className="text-lg font-semibold flex items-center gap-2">
//                 <User className="h-5 w-5" />
//                 Personal Information
//               </h3>
//               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//                 <TextInput
//                   register={register}
//                   errors={errors}
//                   label="First Name"
//                   name="firstName"
//                   icon={User}
//                 />
//                 <TextInput
//                   register={register}
//                   errors={errors}
//                   label="Last Name *"
//                   name="lastName"
//                   icon={User}
//                   isRequired={true}
//                 />
//                 <div className="space-y-2">
//                   <Label htmlFor="phone">Phone Number</Label>
//                   <div className="relative">
//                     <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
//                     <Input
//                       id="phone"
//                       type="tel"
//                       value={phone}
//                       onChange={handlePhoneChange}
//                       placeholder="+256 700 000000"
//                       className="pl-10"
//                     />
//                   </div>
//                 </div>
//                 <TextInput
//                   register={register}
//                   errors={errors}
//                   label="Email Address *"
//                   name="email"
//                   type="email"
//                   icon={Mail}
//                   isRequired={true}
//                 />
//                 <TextInput
//                   register={register}
//                   errors={errors}
//                   label="Date of Birth"
//                   name="dateOfBirth"
//                   type="date"
//                   icon={Calendar}
//                 />
//                 <TextInput
//                   register={register}
//                   errors={errors}
//                   label="National ID"
//                   name="nationalId"
//                   icon={CreditCard}
//                 />
//               </div>
//             </div>

//             <div className="space-y-4">
//               <h3 className="text-lg font-semibold flex items-center gap-2">
//                 <CreditCard className="h-5 w-5" />
//                 Additional Information
//               </h3>
//               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//                 {userRole === "MEMBER" ? (
//                   <TextInput
//                     register={register}
//                     errors={errors}
//                     label="Occupation Title"
//                     name="jobTitle"
//                     icon={User}
//                   />
//                 ) : userRole === "AGENT" ? (
//                   <TextInput
//                     register={register}
//                     errors={errors}
//                     label="Area of Operation"
//                     name="areaOfOperation"
//                     icon={User}
//                   />
//                 ) : (
//                   <FormSelectInput
//                     label="Branch *"
//                     options={branchOptions}
//                     option={selectedBranch as Option}
//                     setOption={setSelectedBranch}
//                     toolTipText="Add New Branch"
//                     href="/dashboard/branches"
//                   />
//                 )}

//                 <div className="space-y-2">
//                   <Label htmlFor="password">
//                     Password * {editingId && "(Leave blank to keep current)"}
//                   </Label>
//                   <div className="relative">
//                     <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
//                     <Input
//                       id="password"
//                       type={showPassword ? "text" : "password"}
//                       {...register("password", {
//                         required: !editingId,
//                         minLength: {
//                           value: 6,
//                           message: "Password must be at least 6 characters",
//                         },
//                       })}
//                       placeholder={
//                         editingId ? "Enter new password" : "Enter password"
//                       }
//                       className="pl-10 pr-10"
//                     />
//                     <button
//                       type="button"
//                       onClick={() => setShowPassword(!showPassword)}
//                       className="absolute right-3 top-1/2 -translate-y-1/2"
//                     >
//                       {showPassword ? (
//                         <EyeOff className="h-4 w-4 text-muted-foreground" />
//                       ) : (
//                         <Eye className="h-4 w-4 text-muted-foreground" />
//                       )}
//                     </button>
//                   </div>
//                   {errors.password && (
//                     <p className="text-sm text-destructive">
//                       {errors.password.message}
//                     </p>
//                   )}
//                 </div>
//               </div>
//             </div>

//             {userRole === "MEMBER" && (
//               <div className="grid grid-cols-1 gap-4">
//                 <FormSelectInput
//                   label="Branch *"
//                   options={branchOptions}
//                   option={selectedBranch as Option}
//                   setOption={setSelectedBranch}
//                   toolTipText="Add New Branch"
//                   href="/dashboard/branches"
//                 />
//               </div>
//             )}
//           </div>
//         </form>

//         <DialogFooter className="border-t pt-4">
//           <div className="flex items-center justify-between w-full">
//             <p className="text-sm text-muted-foreground">
//               {imageUrl ? "Photo uploaded" : "No photo uploaded"}
//             </p>
//             <div className="flex gap-2">
//               <Button
//                 type="button"
//                 variant="outline"
//                 onClick={() => {
//                   reset();
//                   setImageUrl("");
//                   onClose();
//                 }}
//                 disabled={loading || isUploading}
//               >
//                 Cancel
//               </Button>
//               <Button
//                 type="submit"
//                 onClick={handleSubmit(saveUser)}
//                 disabled={loading || isUploading}
//               >
//                 {loading
//                   ? "Saving..."
//                   : isUploading
//                     ? "Uploading..."
//                     : editingId
//                       ? `Update ${getRoleDisplayName().name}`
//                       : `Create ${getRoleDisplayName().name}`}
//               </Button>
//             </div>
//           </div>
//         </DialogFooter>

//         {isCameraOpen && (
//           <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
//             <div className="bg-background rounded-lg max-w-2xl w-full p-6 space-y-4">
//               <div className="flex items-center justify-between">
//                 <h3 className="text-lg font-semibold">Capture Photo</h3>
//                 <Button
//                   type="button"
//                   variant="ghost"
//                   size="sm"
//                   onClick={closeCamera}
//                   disabled={isUploading}
//                 >
//                   <X className="h-5 w-5" />
//                 </Button>
//               </div>

//               <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
//                 {capturedPreview ? (
//                   <img
//                     src={capturedPreview}
//                     alt="Captured preview"
//                     className="w-full h-full object-contain"
//                   />
//                 ) : (
//                   <video
//                     ref={videoRef}
//                     autoPlay
//                     playsInline
//                     muted
//                     className="w-full h-full object-contain"
//                   />
//                 )}
//               </div>

//               <div className="flex gap-2 justify-center">
//                 {!capturedPreview ? (
//                   <Button type="button" onClick={capturePhoto}>
//                     <Camera className="h-4 w-4 mr-2" />
//                     Capture
//                   </Button>
//                 ) : (
//                   <>
//                     <Button
//                       type="button"
//                       variant="outline"
//                       onClick={() => setCapturedPreview(null)}
//                       disabled={isUploading}
//                     >
//                       Retake
//                     </Button>
//                     <Button
//                       type="button"
//                       onClick={() => uploadCapturedImage(capturedPreview)}
//                       disabled={isUploading}
//                     >
//                       {isUploading ? "Uploading..." : "Use This Image"}
//                     </Button>
//                   </>
//                 )}
//               </div>
//             </div>
//           </div>
//         )}
//       </DialogContent>
//     </Dialog>
//   );
// }
"use client";
import React, { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  User,
  Phone,
  Mail,
  Calendar,
  CreditCard,
  Lock,
  Camera,
  Upload,
  X,
  Eye,
  EyeOff,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import TextInput from "@/components/FormInputs/TextInput";
import { UserCreateDTO } from "@/types/user";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Branch } from "@prisma/client";
import FormSelectInput from "@/components/FormInputs/FormSelectInput";
import { useUploadThing } from "@/lib/uploadthing";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Option = {
  label: string;
  value: string;
};

export default function UserCreateForm({
  initialData,
  editingId,
  isOpen,
  onClose,
  branchId,
  role,
  branches,
}: {
  initialData?: Partial<UserCreateDTO>;
  editingId?: string;
  isOpen: boolean;
  onClose?: () => void;
  branchId?: string;
  role?: string;
  branches: Branch[];
}) {

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
    watch,
    setValue,
  } = useForm<UserCreateDTO>({
    defaultValues: {
      firstName: initialData?.firstName || "",
      lastName: initialData?.lastName || "",
      phone: initialData?.phone || "",
      email: initialData?.email || "",
      nationalId: initialData?.nationalId || "",
      password: `Password@${new Date().getFullYear()}`,
      jobTitle: initialData?.jobTitle || "",
      image: initialData?.image || "",
    },
  });

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>(initialData?.image || "");
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [phone, setPhone] = useState("+256 ");

  const router = useRouter();
  const userRole = role?.toUpperCase();
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { startUpload, isUploading } = useUploadThing("userProfileImage", {
    onClientUploadComplete: (res) => {
      console.log("✅ Client upload complete:", res);
      if (res && res.length > 0 && res[0]?.url) {
        const uploadedUrl = res[0].url;
        console.log("📸 Setting image URL:", uploadedUrl);
        setImageUrl(uploadedUrl);
        setValue("image", uploadedUrl);
        toast.success("Photo uploaded successfully!");
      } else {
        console.error("❌ No URL in response:", res);
        toast.error("Upload completed but no URL returned");
      }
    },
    onUploadError: (error) => {
      console.error("❌ Upload error:", error);
      toast.error(`Upload failed: ${error.message}`);
    },
    onUploadBegin: (fileName) => {
      console.log("📤 Upload begin:", fileName);
      toast.info("Uploading...");
    },
  });

  const getRoleDisplayName = () => {
    switch (role?.toUpperCase()) {
      case "ADMIN":
        return { name: "Administrator", path: "admin" };
      case "BRANCHMANAGER":
        return { name: "Branch Manager", path: "managers" };
      case "TELLER":
        return { name: "Teller", path: "tellers" };
      case "AGENT":
        return { name: "Agent", path: "agents" };
      case "MEMBER":
        return { name: "Member", path: "members" };
      case "ACCOUNTANT":
        return { name: "Accountant", path: "accountants" };
      case "LOANOFFICER":
        return { name: "Loan Officer", path: "loan-officers" };
      case "AUDITOR":
        return { name: "Auditor", path: "auditors" };
      default:
        return { name: "User", path: "users" };
    }
  };

  const branchOptions = branches.map((item) => ({
    label: item.name,
    value: item.id,
  }));

  const [selectedBranch, setSelectedBranch] = useState<Option>(
    branchOptions[0] || { label: "No Branch", value: "" }
  );

  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      setCameraStream(stream);
      setIsCameraOpen(true);
      setCapturedPreview(null);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch((err) => {
            console.error("Error playing video:", err);
            toast.error("Failed to start video stream");
          });
        }
      }, 100);
    } catch (error) {
      console.error("Error accessing camera:", error);
      toast.error("Unable to access camera. Please check permissions.");
    }
  };

  const closeCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraOpen(false);
    setCapturedPreview(null);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;

    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(videoRef.current, 0, 0);
    const base64Image = canvas.toDataURL("image/jpeg", 0.9);

    setCapturedPreview(base64Image);
  };

  const uploadCapturedImage = async (base64Image: string) => {
    try {
      console.log("📷 Converting captured image to file...");
      const response = await fetch(base64Image);
      const blob = await response.blob();

      console.log("📦 Blob size:", blob.size, "bytes");
      console.log("📦 Blob type:", blob.type);

      const fileName = `user_profile_${Date.now()}.jpg`;
      const file = new File([blob], fileName, { type: "image/jpeg" });

      console.log("📤 Starting upload for:", fileName);
      const res = await startUpload([file]);

      console.log("📥 Upload response:", res);

      if (res && res.length > 0 && res[0]?.url) {
        console.log("✅ Camera upload successful");
        closeCamera();
      } else {
        console.error("❌ No URL in camera upload response");
        toast.error("Upload completed but no URL returned");
      }
    } catch (error: any) {
      console.error("❌ Camera upload error:", error);
      toast.error(`Upload failed: ${error.message || "Unknown error"}`);
    }
  };

  const handleFileSelect = async (file: File) => {
    if (!file) {
      console.log("⚠️ No file selected");
      return;
    }

    console.log("📁 File selected:", {
      name: file.name,
      size: file.size,
      type: file.type,
    });

    if (file.size > 2 * 1024 * 1024) {
      toast.error("File size must be less than 2MB");
      console.error("❌ File too large:", file.size, "bytes");
      return;
    }

    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      toast.error("Only JPG, JPEG, PNG, and WEBP files are allowed");
      console.error("❌ Invalid file type:", file.type);
      return;
    }

    console.log("✅ File validation passed, starting upload...");

    try {
      const res = await startUpload([file]);
      console.log("📥 File upload response:", res);

      if (!res || res.length === 0) {
        console.error("❌ Empty upload response");
        toast.error("Upload failed - no response from server");
      }
    } catch (error: any) {
      console.error("❌ File upload error:", error);
      toast.error(`Upload failed: ${error.message || "Unknown error"}`);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    console.log("📂 Files dropped:", files.length);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    if (!value.startsWith("+256")) {
      value = "+256 ";
    }
    setPhone(value);
  };

  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraStream]);

  useEffect(() => {
    if (!isOpen) {
      closeCamera();
    }
  }, [isOpen]);

  useEffect(() => {
    if (editingId && initialData) {
      Object.keys(initialData).forEach((key) => {
        setValue(
          key as keyof UserCreateDTO,
          initialData[key as keyof UserCreateDTO]
        );
      });
      setImageUrl(initialData.image || "");
      if (initialData.phone) {
        setPhone(initialData.phone);
      }
    }
  }, [editingId, initialData, setValue]);

  // ✅ UPDATED: Better error handling and success messages
  async function saveUser(data: UserCreateDTO) {
    try {
      setLoading(true);

      // Validation checks
      if (!editingId && !data.password) {
        toast.error("Password is required");
        setLoading(false);
        return;
      }

      if (!data.lastName) {
        toast.error("Last Name is required");
        setLoading(false);
        return;
      }

      if (!data.email) {
        toast.error("Email Address is required");
        setLoading(false);
        return;
      }

      if (!selectedBranch.value) {
        toast.error("Please select a branch");
        setLoading(false);
        return;
      }

      const name = `${data.firstName || ""} ${data.lastName}`.trim();

      // ✅ Prepare payload matching API schema
      const payload = {
        firstName: data.firstName || "",
        lastName: data.lastName,
        email: data.email,
        password: data.password || `Password@${new Date().getFullYear()}`,
        name: name,
        phone: phone || null,
        dateOfBirth: data.dateOfBirth || null,
        nationalId: data.nationalId || null,
        jobTitle: data.jobTitle || null,
        branchId: selectedBranch.value,
        role: role?.toUpperCase() || "MEMBER",
        areaOfOperation: data.areaOfOperation || null,
        image: imageUrl || null,
        address: data.address || null,
      };

      const endpoint = `/api/v1/users`;
      const method = editingId ? "PUT" : "POST";
      const bodyData = editingId ? { ...payload, userId: editingId } : payload;

      console.log("📤 Submitting to API:", { endpoint, method, bodyData });

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bodyData),
      });

      const result = await response.json();
      console.log("📥 API Response:", result);

      if (!response.ok) {
        // ✅ Better error handling from API
        const errorMessage = result.error || "Something went wrong";
        const errorDetails = result.details
          ? result.details.map((d: any) => d.message).join(", ")
          : "";

        toast.error(
          editingId ? "Failed to Update User" : "Failed to Create User",
          {
            description: errorDetails || errorMessage,
          }
        );
        setLoading(false);
        return;
      }

      setLoading(false);

      // ✅ Updated success message for pending approval workflow
      if (editingId) {
        toast.success("User Updated Successfully!", {
          description: "Changes have been saved",
        });
      } else {
        toast.success("User Created Successfully!", {
          description: result.message || "Pending approval from branch manager",
        });
      }

      reset();
      setImageUrl("");
      setPhone("+256 ");
      if (onClose) {
        onClose();
      } else {
        router.back();
      }
      router.refresh();
    } catch (error: any) {
      console.error("❌ ERROR:", error);
      toast.error("Something went wrong", {
        description: error.message || "Please try again",
      });
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          reset();
          setImageUrl("");
          setPhone("+256 ");
          if (onClose) {
            onClose();
          } else {
            router.back();
          }
        }
      }}
    >
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {editingId
              ? `Edit ${getRoleDisplayName().name}`
              : `Add New ${getRoleDisplayName().name}`}
          </DialogTitle>
          <DialogDescription>
            Fill in the {getRoleDisplayName().name?.toLowerCase() || "user"} information
            below. Fields marked with * are required.
            {!editingId &&
              " Account will be pending approval from branch manager."}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(saveUser)}
          className="flex-1 overflow-y-auto"
        >
          <div className="space-y-6 p-1">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile Photo
              </h3>

              <div className="flex justify-center">
                <div className="space-y-3 w-full max-w-md">
                  <div
                    className={`w-full aspect-video rounded-lg border-2 border-dashed flex items-center justify-center transition-colors ${
                      isDragging
                        ? "border-primary bg-primary/5"
                        : "border-muted-foreground/25 hover:border-primary/50"
                    } ${isUploading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => {
                      if (!isUploading) {
                        fileInputRef.current?.click();
                      }
                    }}
                  >
                    {imageUrl ? (
                      <div className="relative w-full h-full">
                        <img
                          src={imageUrl}
                          alt="Profile preview"
                          className="w-full h-full object-cover rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setImageUrl("");
                            setValue("image", "");
                            toast.success("Photo removed");
                          }}
                          className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full p-2 shadow-lg hover:bg-destructive/90"
                          disabled={isUploading}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="text-center p-8">
                        <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                        <p className="text-sm font-medium text-muted-foreground mb-1">
                          {isUploading
                            ? "Uploading..."
                            : "Drop photo here or click to browse"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          JPG, PNG up to 2MB
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="flex-1"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {imageUrl ? "Change Photo" : "Upload File"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={openCamera}
                      disabled={isUploading}
                      className="flex-1"
                    >
                      <Camera className="h-4 w-4 mr-2" />
                      Open Camera
                    </Button>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleFileSelect(file);
                      }
                    }}
                    className="hidden"
                    disabled={isUploading}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <User className="h-5 w-5" />
                Personal Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TextInput
                  register={register}
                  errors={errors}
                  label="First Name"
                  name="firstName"
                  icon={User}
                />
                <TextInput
                  register={register}
                  errors={errors}
                  label="Last Name *"
                  name="lastName"
                  icon={User}
                  isRequired={true}
                />
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={handlePhoneChange}
                      placeholder="+256 700 000000"
                      className="pl-10"
                    />
                  </div>
                </div>
                <TextInput
                  register={register}
                  errors={errors}
                  label="Email Address *"
                  name="email"
                  type="email"
                  icon={Mail}
                  isRequired={true}
                />
                <TextInput
                  register={register}
                  errors={errors}
                  label="Date of Birth"
                  name="dateOfBirth"
                  type="date"
                  icon={Calendar}
                />
                <TextInput
                  register={register}
                  errors={errors}
                  label="National ID"
                  name="nationalId"
                  icon={CreditCard}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Additional Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {userRole === "MEMBER" ? (
                  <TextInput
                    register={register}
                    errors={errors}
                    label="Occupation Title"
                    name="jobTitle"
                    icon={User}
                  />
                ) : userRole === "AGENT" ? (
                  <TextInput
                    register={register}
                    errors={errors}
                    label="Area of Operation"
                    name="areaOfOperation"
                    icon={User}
                  />
                ) : (
                  <FormSelectInput
                    label="Branch *"
                    options={branchOptions}
                    option={selectedBranch as Option}
                    setOption={setSelectedBranch}
                    toolTipText="Add New Branch"
                    href="/dashboard/branches"
                  />
                )}

                <div className="space-y-2">
                  <Label htmlFor="password">
                    Password * {editingId && "(Leave blank to keep current)"}
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      {...register("password", {
                        required: !editingId,
                        minLength: {
                          value: 6,
                          message: "Password must be at least 6 characters",
                        },
                      })}
                      placeholder={
                        editingId ? "Enter new password" : "Enter password"
                      }
                      className="pl-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-sm text-destructive">
                      {errors.password.message}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {userRole === "MEMBER" && (
              <div className="grid grid-cols-1 gap-4">
                <FormSelectInput
                  label="Branch *"
                  options={branchOptions}
                  option={selectedBranch as Option}
                  setOption={setSelectedBranch}
                  toolTipText="Add New Branch"
                  href="/dashboard/branches"
                />
              </div>
            )}
          </div>
        </form>

        <DialogFooter className="border-t pt-4">
          <div className="flex items-center justify-between w-full">
            <p className="text-sm text-muted-foreground">
              {imageUrl ? "Photo uploaded" : "No photo uploaded"}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  reset();
                  setImageUrl("");
                  setPhone("+256 ");
                  if (onClose) {
                    onClose();
                  } else {
                    router.back();
                  }
                }}
                disabled={loading || isUploading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                onClick={handleSubmit(saveUser)}
                disabled={loading || isUploading}
              >
                {loading
                  ? "Saving..."
                  : isUploading
                    ? "Uploading..."
                    : editingId
                      ? `Update ${getRoleDisplayName().name}`
                      : `Create ${getRoleDisplayName().name}`}
              </Button>
            </div>
          </div>
        </DialogFooter>

        {isCameraOpen && (
          <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
            <div className="bg-background rounded-lg max-w-2xl w-full p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Capture Photo</h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={closeCamera}
                  disabled={isUploading}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                {capturedPreview ? (
                  <img
                    src={capturedPreview}
                    alt="Captured preview"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-contain"
                  />
                )}
              </div>

              <div className="flex gap-2 justify-center">
                {!capturedPreview ? (
                  <Button type="button" onClick={capturePhoto}>
                    <Camera className="h-4 w-4 mr-2" />
                    Capture
                  </Button>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCapturedPreview(null)}
                      disabled={isUploading}
                    >
                      Retake
                    </Button>
                    <Button
                      type="button"
                      onClick={() => uploadCapturedImage(capturedPreview)}
                      disabled={isUploading}
                    >
                      {isUploading ? "Uploading..." : "Use This Image"}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
