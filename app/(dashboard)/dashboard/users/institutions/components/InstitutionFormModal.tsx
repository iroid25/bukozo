// @ts-nocheck
// // app/dashboard/users/institutions/components/InstitutionFormModal.tsx
// "use client";

// import { useEffect, useState, useRef } from "react";
// import { Branch, UserRole } from "@prisma/client";
// import { toast } from "sonner";
// import { useRouter } from "next/navigation";
// import {
//   Building2,
//   Users,
//   MapPin,
//   CreditCard,
//   Camera,
//   X,
//   Plus,
//   Trash2,
// } from "lucide-react";
// import {
//   Dialog,
//   DialogContent,
//   DialogDescription,
//   DialogFooter,
//   DialogHeader,
//   DialogTitle,
// } from "@/components/ui/dialog";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";
// import { Textarea } from "@/components/ui/textarea";
// import { createInstitution, updateInstitution } from "@/actions/institutions";

// interface Administrator {
//   name: string;
//   post: string;
//   phone: string;
//   email?: string;
//   photo?: string; // Base64 encoded
//   signature?: string; // Base64 encoded or typed signature
// }

// interface InstitutionFormData {
//   // Basic Information
//   institutionName: string;
//   institutionType: string;
//   institutionPhone: string;
//   institutionEmail: string;
//   branchId: string;
//   password: string;

//   // Organization Background (from loan application form)
//   foundedDate?: string;
//   founders?: string;
//   majorObjective?: string;
//   majorActivities?: string;
//   legalStatus?: string;
//   registrationNumber?: string;
//   tinNumber?: string;
//   yearEstablished?: string;
//   businessSector?: string;
//   numberOfEmployees?: string;

//   // Primary Contact
//   primaryContactPerson: string;
//   primaryContactPhone: string;
//   primaryContactEmail?: string;
//   primaryContactTitle?: string;

//   // Location
//   plotNumber?: string;
//   street?: string;
//   village?: string;
//   parish?: string;
//   subCounty?: string;
//   constituency?: string;
//   town?: string;
//   district?: string;
//   postalAddress?: string;

//   // Account Details
//   accountTitle?: string;
//   accountType?: string;
//   operatingInstructions?: string;
//   signatoryChangeRules?: string;

//   // Banking
//   bankName?: string;
//   bankAccountNumber?: string;

//   // Financial
//   entryFee?: string;
//   initialDeposit?: string;

//   // Other
//   description?: string;
//   notes?: string;
// }

// interface InstitutionFormModalProps {
//   isOpen: boolean;
//   onClose: () => void;
//   mode: "create" | "edit";
//   initial?: any;
//   branches: Branch[];
//   branchId?: string;
//   role?: UserRole;
// }

// const organizationTypes = [
//   { label: "School", value: "SCHOOL" },
//   { label: "Hospital", value: "HOSPITAL" },
//   { label: "Clinic", value: "CLINIC" },
//   { label: "Company", value: "COMPANY" },
//   { label: "Government", value: "GOVERNMENT" },
//   { label: "NGO", value: "NGO" },
//   { label: "Cooperative", value: "COOPERATIVE" },
//   { label: "Association", value: "ASSOCIATION" },
//   { label: "Religious Organization", value: "RELIGIOUS" },
//   { label: "Community Group", value: "COMMUNITY" },
//   { label: "Other", value: "OTHER" },
// ];

// const legalStatuses = [
//   { label: "Village Level", value: "VILLAGE" },
//   { label: "Sub County Level", value: "SUBCOUNTY" },
//   { label: "District Level", value: "DISTRICT" },
//   { label: "National Level", value: "NATIONAL" },
//   { label: "International", value: "INTERNATIONAL" },
// ];

// const accountTypes = [
//   { label: "Savings Account", value: "SAVINGS" },
//   { label: "Current Account", value: "CURRENT" },
//   { label: "Fixed Deposit", value: "FIXED_DEPOSIT" },
// ];

// export default function InstitutionFormModal({
//   isOpen,
//   onClose,
//   mode,
//   initial,
//   branches,
//   branchId,
//   role,
// }: InstitutionFormModalProps) {
//   const router = useRouter();
//   const [isSubmitting, setIsSubmitting] = useState(false);
//   const [activeTab, setActiveTab] = useState<
//     | "basic"
//     | "background"
//     | "contact"
//     | "location"
//     | "account"
//     | "administrators"
//     | "financial"
//   >("basic");

//   const [administrators, setAdministrators] = useState<Administrator[]>([
//     { name: "", post: "", phone: "", email: "" },
//     { name: "", post: "", phone: "", email: "" },
//   ]);

//   // Camera refs
//   const videoRef = useRef<HTMLVideoElement>(null);
//   const [isCameraOpen, setIsCameraOpen] = useState(false);
//   const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
//   const [currentCameraIndex, setCurrentCameraIndex] = useState<{
//     adminIndex: number;
//     field: "photo" | "signature";
//   } | null>(null);
//   const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
//   const [isUploading, setIsUploading] = useState(false);

//   const [form, setForm] = useState<InstitutionFormData>({
//     institutionName: "",
//     institutionType: "SCHOOL",
//     institutionPhone: "",
//     institutionEmail: "",
//     primaryContactPerson: "",
//     primaryContactPhone: "",
//     branchId: branchId || "",
//     password: "",
//     primaryContactEmail: "",
//     primaryContactTitle: "",
//     foundedDate: "",
//     founders: "",
//     majorObjective: "",
//     majorActivities: "",
//     legalStatus: "",
//     registrationNumber: "",
//     tinNumber: "",
//     yearEstablished: "",
//     businessSector: "",
//     numberOfEmployees: "",
//     plotNumber: "",
//     street: "",
//     village: "",
//     parish: "",
//     subCounty: "",
//     constituency: "",
//     town: "",
//     district: "",
//     postalAddress: "",
//     accountTitle: "",
//     accountType: "",
//     operatingInstructions: "",
//     signatoryChangeRules: "",
//     bankName: "",
//     bankAccountNumber: "",
//     entryFee: "30000",
//     initialDeposit: "20000",
//     description: "",
//     notes: "",
//   });

//   useEffect(() => {
//     if (mode === "edit" && initial) {
//       setForm({
//         institutionName: initial.institutionName || "",
//         institutionType: initial.institutionType || "SCHOOL",
//         institutionPhone: initial.institutionPhone || "",
//         institutionEmail: initial.institutionEmail || "",
//         primaryContactPerson: initial.primaryContactPerson || "",
//         primaryContactPhone: initial.primaryContactPhone || "",
//         branchId: initial.user?.branchId || branchId || "",
//         password: "",
//         primaryContactEmail: initial.primaryContactEmail || "",
//         primaryContactTitle: initial.primaryContactTitle || "",
//         foundedDate: initial.foundedDate || "",
//         founders: initial.founders || "",
//         majorObjective: initial.majorObjective || "",
//         majorActivities: initial.majorActivities || "",
//         legalStatus: initial.legalStatus || "",
//         registrationNumber: initial.registrationNumber || "",
//         tinNumber: initial.tinNumber || "",
//         yearEstablished: initial.yearEstablished?.toString() || "",
//         businessSector: initial.businessSector || "",
//         numberOfEmployees: initial.numberOfEmployees?.toString() || "",
//         plotNumber: initial.plotNumber || "",
//         street: initial.street || "",
//         village: initial.village || "",
//         parish: initial.parish || "",
//         subCounty: initial.subCounty || "",
//         constituency: initial.constituency || "",
//         town: initial.town || "",
//         district: initial.district || "",
//         postalAddress: initial.postalAddress || "",
//         accountTitle: initial.accountTitle || "",
//         accountType: initial.accountType || "",
//         operatingInstructions: initial.operatingInstructions || "",
//         signatoryChangeRules: initial.signatoryChangeRules || "",
//         bankName: initial.bankName || "",
//         bankAccountNumber: initial.bankAccountNumber || "",
//         entryFee: initial.entryFee?.toString() || "30000",
//         initialDeposit: initial.initialDeposit?.toString() || "20000",
//         description: initial.description || "",
//         notes: initial.notes || "",
//       });

//       if (initial.administrators && Array.isArray(initial.administrators)) {
//         setAdministrators(
//           initial.administrators.length > 0
//             ? initial.administrators
//             : [
//                 { name: "", post: "", phone: "", email: "" },
//                 { name: "", post: "", phone: "", email: "" },
//               ]
//         );
//       }
//     } else {
//       setForm((prev) => ({
//         ...prev,
//         branchId: branchId || "",
//       }));
//     }
//   }, [mode, initial, branchId]);

//   const handleChange = (
//     e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
//   ) => {
//     const { name, value } = e.target;
//     setForm((prev) => ({ ...prev, [name]: value }));
//   };

//   const handleSelectChange = (name: string, value: string) => {
//     setForm((prev) => ({ ...prev, [name]: value }));
//   };

//   const handleAdministratorChange = (
//     index: number,
//     field: keyof Administrator,
//     value: string
//   ) => {
//     const newAdmins = [...administrators];
//     newAdmins[index][field] = value;
//     setAdministrators(newAdmins);
//   };

//   const openCamera = async (index: number, field: "photo" | "signature") => {
//     try {
//       const stream = await navigator.mediaDevices.getUserMedia({
//         video: { facingMode: "user", width: 640, height: 480 },
//       });

//       setCameraStream(stream);
//       setCurrentCameraIndex({ adminIndex: index, field });
//       setIsCameraOpen(true);

//       if (videoRef.current) {
//         videoRef.current.srcObject = stream;
//       }
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
//     setIsCameraOpen(false);
//     setCurrentCameraIndex(null);
//     setCapturedPreview(null);
//   };

//   const capturePhoto = () => {
//     if (!videoRef.current || !currentCameraIndex) return;

//     const canvas = document.createElement("canvas");
//     canvas.width = videoRef.current.videoWidth;
//     canvas.height = videoRef.current.videoHeight;

//     const ctx = canvas.getContext("2d");
//     if (!ctx) return;

//     ctx.drawImage(videoRef.current, 0, 0);
//     const base64Image = canvas.toDataURL("image/jpeg", 0.8);

//     setCapturedPreview(base64Image);
//   };

//   const uploadToUploadThing = async (base64Image: string) => {
//     if (!currentCameraIndex) return;

//     try {
//       setIsUploading(true);

//       // Convert base64 to blob
//       const response = await fetch(base64Image);
//       const blob = await response.blob();

//       // Create a file from blob
//       const fieldType =
//         currentCameraIndex.field === "photo" ? "photo" : "signature";
//       const fileName = `institution_admin_${fieldType}_${Date.now()}.jpg`;
//       const file = new File([blob], fileName, { type: "image/jpeg" });

//       // Prepare FormData for UploadThing
//       const formData = new FormData();
//       formData.append("files", file);

//       // Determine the correct endpoint based on field type
//       const endpoint =
//         currentCameraIndex.field === "photo"
//           ? "institutionAdminPhoto"
//           : "institutionAdminSignature";

//       // Upload to UploadThing using the correct endpoint
//       const uploadResponse = await fetch(`/api/uploadthing?slug=${endpoint}`, {
//         method: "POST",
//         body: formData,
//       });

//       if (!uploadResponse.ok) {
//         const errorText = await uploadResponse.text();
//         console.error("Upload failed:", errorText);
//         throw new Error("Upload failed");
//       }

//       const result = await uploadResponse.json();

//       // UploadThing returns an array of uploaded files
//       const uploadedUrl = result[0]?.url || result.url || base64Image;

//       // Store the URL in administrators
//       const newAdmins = [...administrators];
//       newAdmins[currentCameraIndex.adminIndex][currentCameraIndex.field] =
//         uploadedUrl;
//       setAdministrators(newAdmins);

//       closeCamera();
//       toast.success(
//         `${currentCameraIndex.field === "photo" ? "Photo" : "Signature"} uploaded successfully`
//       );
//     } catch (error) {
//       console.error("Upload error:", error);
//       toast.error("Failed to upload to server. Saving locally instead.");

//       // Fallback: save base64 locally if upload fails
//       const newAdmins = [...administrators];
//       newAdmins[currentCameraIndex.adminIndex][currentCameraIndex.field] =
//         base64Image;
//       setAdministrators(newAdmins);

//       closeCamera();
//     } finally {
//       setIsUploading(false);
//     }
//   };

//   // Cleanup camera on unmount or dialog close
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

//   const handleFileUpload = async (
//     index: number,
//     field: "photo" | "signature",
//     file: File
//   ) => {
//     if (!file) return;

//     // Validate file size (max 2MB)
//     if (file.size > 2 * 1024 * 1024) {
//       toast.error("File size must be less than 2MB");
//       return;
//     }

//     // Validate file type
//     const validTypes = ["image/jpeg", "image/jpg", "image/png"];
//     if (!validTypes.includes(file.type)) {
//       toast.error("Only JPG, JPEG, and PNG files are allowed");
//       return;
//     }

//     try {
//       const base64 = await new Promise<string>((resolve, reject) => {
//         const reader = new FileReader();
//         reader.onload = () => resolve(reader.result as string);
//         reader.onerror = reject;
//         reader.readAsDataURL(file);
//       });

//       const newAdmins = [...administrators];
//       newAdmins[index][field] = base64;
//       setAdministrators(newAdmins);
//       toast.success(
//         `${field === "photo" ? "Photo" : "Signature"} uploaded successfully`
//       );
//     } catch (error) {
//       toast.error("Failed to upload file");
//     }
//   };

//   const addAdministrator = () => {
//     setAdministrators([
//       ...administrators,
//       { name: "", post: "", phone: "", email: "" },
//     ]);
//   };

//   const removeAdministrator = (index: number) => {
//     if (administrators.length > 2) {
//       setAdministrators(administrators.filter((_, i) => i !== index));
//     } else {
//       toast.error("At least 2 administrators are required");
//     }
//   };

//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setIsSubmitting(true);

//     try {
//       // Validate required fields
//       if (!form.institutionName.trim()) {
//         toast.error("Institution name is required");
//         setIsSubmitting(false);
//         return;
//       }

//       if (!form.institutionEmail.trim()) {
//         toast.error("Institution email is required");
//         setIsSubmitting(false);
//         return;
//       }

//       if (!form.institutionPhone.trim()) {
//         toast.error("Institution phone is required");
//         setIsSubmitting(false);
//         return;
//       }

//       if (!form.primaryContactPerson.trim()) {
//         toast.error("Primary contact person is required");
//         setIsSubmitting(false);
//         return;
//       }

//       if (!form.primaryContactPhone.trim()) {
//         toast.error("Primary contact phone is required");
//         setIsSubmitting(false);
//         return;
//       }

//       if (!form.branchId) {
//         toast.error("Branch is required");
//         setIsSubmitting(false);
//         return;
//       }

//       if (mode === "create" && !form.password.trim()) {
//         toast.error("Password is required");
//         setIsSubmitting(false);
//         return;
//       }

//       // Validate administrators
//       const validAdministrators = administrators.filter(
//         (admin) => admin.name.trim() && admin.post.trim()
//       );

//       if (validAdministrators.length < 2) {
//         toast.error(
//           "At least 2 administrators with name and position are required"
//         );
//         setIsSubmitting(false);
//         return;
//       }

//       if (mode === "create") {
//         const createData = {
//           institutionName: form.institutionName.trim(),
//           institutionType: form.institutionType,
//           institutionPhone: form.institutionPhone.trim(),
//           institutionEmail: form.institutionEmail.trim().toLowerCase(),
//           primaryContactPerson: form.primaryContactPerson.trim(),
//           primaryContactPhone: form.primaryContactPhone.trim(),
//           branchId:
//             role === "ADMIN" ? form.branchId : branchId || form.branchId,
//           password: form.password,
//           ...(form.primaryContactEmail && {
//             primaryContactEmail: form.primaryContactEmail.trim(),
//           }),
//           ...(form.primaryContactTitle && {
//             primaryContactTitle: form.primaryContactTitle.trim(),
//           }),
//           ...(form.foundedDate && { foundedDate: form.foundedDate }),
//           ...(form.founders && { founders: form.founders }),
//           ...(form.majorObjective && { majorObjective: form.majorObjective }),
//           ...(form.majorActivities && {
//             majorActivities: form.majorActivities,
//           }),
//           ...(form.legalStatus && { legalStatus: form.legalStatus }),
//           ...(form.registrationNumber && {
//             registrationNumber: form.registrationNumber.trim(),
//           }),
//           ...(form.tinNumber && { tinNumber: form.tinNumber.trim() }),
//           ...(form.yearEstablished && {
//             yearEstablished: form.yearEstablished,
//           }),
//           ...(form.businessSector && { businessSector: form.businessSector }),
//           ...(form.numberOfEmployees && {
//             numberOfEmployees: form.numberOfEmployees,
//           }),
//           ...(form.plotNumber && { plotNumber: form.plotNumber }),
//           ...(form.street && { street: form.street }),
//           ...(form.village && { village: form.village }),
//           ...(form.parish && { parish: form.parish }),
//           ...(form.subCounty && { subCounty: form.subCounty }),
//           ...(form.constituency && { constituency: form.constituency }),
//           ...(form.town && { town: form.town }),
//           ...(form.district && { district: form.district }),
//           ...(form.postalAddress && { postalAddress: form.postalAddress }),
//           ...(form.accountTitle && { accountTitle: form.accountTitle }),
//           ...(form.accountType && { accountType: form.accountType }),
//           ...(form.operatingInstructions && {
//             operatingInstructions: form.operatingInstructions,
//           }),
//           ...(form.signatoryChangeRules && {
//             signatoryChangeRules: form.signatoryChangeRules,
//           }),
//           ...(form.bankName && { bankName: form.bankName }),
//           ...(form.bankAccountNumber && {
//             bankAccountNumber: form.bankAccountNumber,
//           }),
//           ...(form.entryFee && { entryFee: form.entryFee }),
//           ...(form.initialDeposit && { initialDeposit: form.initialDeposit }),
//           administrators: validAdministrators,
//         };

//         const result = await createInstitution(createData);

//         if (result.error) {
//           toast.error(result.error);
//         } else {
//           toast.success("Institution created successfully");
//           router.refresh();
//           onClose();
//         }
//       } else if (mode === "edit" && initial?.id) {
//         const updateData = {
//           institutionName: form.institutionName.trim(),
//           institutionType: form.institutionType,
//           registrationDate:
//             initial.registrationDate || new Date().toISOString(),
//           institutionPhone: form.institutionPhone.trim(),
//           institutionEmail: form.institutionEmail.trim().toLowerCase(),
//           primaryContactPerson: form.primaryContactPerson.trim(),
//           primaryContactPhone: form.primaryContactPhone.trim(),
//           branchId:
//             role === "ADMIN" ? form.branchId : branchId || form.branchId,
//           primaryContactEmail: form.primaryContactEmail || undefined,
//           primaryContactTitle: form.primaryContactTitle || undefined,
//           foundedDate: form.foundedDate || undefined,
//           founders: form.founders || undefined,
//           majorObjective: form.majorObjective || undefined,
//           majorActivities: form.majorActivities || undefined,
//           legalStatus: form.legalStatus || undefined,
//           registrationNumber: form.registrationNumber || undefined,
//           tinNumber: form.tinNumber || undefined,
//           yearEstablished: form.yearEstablished
//             ? parseInt(form.yearEstablished)
//             : undefined,
//           businessSector: form.businessSector || undefined,
//           numberOfEmployees: form.numberOfEmployees
//             ? parseInt(form.numberOfEmployees)
//             : undefined,
//           plotNumber: form.plotNumber || undefined,
//           street: form.street || undefined,
//           village: form.village || undefined,
//           parish: form.parish || undefined,
//           subCounty: form.subCounty || undefined,
//           constituency: form.constituency || undefined,
//           town: form.town || undefined,
//           district: form.district || undefined,
//           postalAddress: form.postalAddress || undefined,
//           accountTitle: form.accountTitle || undefined,
//           accountType: form.accountType || undefined,
//           operatingInstructions: form.operatingInstructions || undefined,
//           signatoryChangeRules: form.signatoryChangeRules || undefined,
//           bankName: form.bankName || undefined,
//           bankAccountNumber: form.bankAccountNumber || undefined,
//           entryFee: form.entryFee ? parseFloat(form.entryFee) : undefined,
//           initialDeposit: form.initialDeposit
//             ? parseFloat(form.initialDeposit)
//             : undefined,
//           administrators: validAdministrators,
//         };

//         const result = await updateInstitution(initial.id, updateData);

//         if (result.error) {
//           toast.error(result.error);
//         } else {
//           toast.success("Institution updated successfully");
//           router.refresh();
//           onClose();
//         }
//       }
//     } catch (error) {
//       console.error("Error submitting form:", error);
//       toast.error("An error occurred. Please try again.");
//     } finally {
//       setIsSubmitting(false);
//     }
//   };

//   const currentBranchName =
//     branches.find((b) => b.id === branchId)?.name || "No branch assigned";

//   const tabs = [
//     { id: "basic" as const, label: "Basic Info", icon: Building2 },
//     { id: "background" as const, label: "Background", icon: Building2 },
//     { id: "contact" as const, label: "Contact", icon: Users },
//     { id: "location" as const, label: "Location", icon: MapPin },
//     { id: "account" as const, label: "Account", icon: CreditCard },
//     { id: "administrators" as const, label: "Administrators", icon: Users },
//     { id: "financial" as const, label: "Financial", icon: CreditCard },
//   ];

//   return (
//     <Dialog open={isOpen} onOpenChange={onClose}>
//       <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
//         <DialogHeader>
//           <DialogTitle>
//             {mode === "create" ? "Create New Institution" : "Edit Institution"}
//           </DialogTitle>
//           <DialogDescription>
//             {mode === "create"
//               ? "Fill in the details to register a new institution"
//               : "Update the institution details below"}
//           </DialogDescription>
//         </DialogHeader>

//         {/* Tab Navigation */}
//         <div className="flex gap-2 overflow-x-auto pb-2 border-b">
//           {tabs.map((tab) => {
//             const Icon = tab.icon;
//             const isActive = activeTab === tab.id;
//             return (
//               <button
//                 key={tab.id}
//                 type="button"
//                 onClick={() => setActiveTab(tab.id)}
//                 className={`flex items-center gap-2 px-4 py-2.5 rounded-lg whitespace-nowrap transition-all font-medium ${
//                   isActive
//                     ? "bg-primary text-primary-foreground shadow-md scale-105 ring-2 ring-primary/20"
//                     : "bg-muted hover:bg-muted/80 text-muted-foreground hover:scale-102"
//                 }`}
//               >
//                 <Icon className="h-4 w-4" />
//                 <span className="text-sm">{tab.label}</span>
//               </button>
//             );
//           })}
//         </div>

//         <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
//           <div className="space-y-6 p-1">
//             {/* Basic Information Tab */}
//             {activeTab === "basic" && (
//               <div className="space-y-4">
//                 <h3 className="text-lg font-semibold flex items-center gap-2">
//                   <Building2 className="h-5 w-5" />
//                   Basic Information
//                 </h3>
//                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//                   <div className="space-y-2">
//                     <Label htmlFor="institutionName">
//                       Institution Name <span className="text-red-500">*</span>
//                     </Label>
//                     <Input
//                       id="institutionName"
//                       name="institutionName"
//                       value={form.institutionName}
//                       onChange={handleChange}
//                       required
//                       placeholder="Enter institution name"
//                     />
//                   </div>

//                   <div className="space-y-2">
//                     <Label htmlFor="institutionType">
//                       Institution Type <span className="text-red-500">*</span>
//                     </Label>
//                     <Select
//                       value={form.institutionType}
//                       onValueChange={(value) =>
//                         handleSelectChange("institutionType", value)
//                       }
//                     >
//                       <SelectTrigger>
//                         <SelectValue placeholder="Select type" />
//                       </SelectTrigger>
//                       <SelectContent>
//                         {organizationTypes.map((type) => (
//                           <SelectItem key={type.value} value={type.value}>
//                             {type.label}
//                           </SelectItem>
//                         ))}
//                       </SelectContent>
//                     </Select>
//                   </div>

//                   {role === "ADMIN" ? (
//                     <div className="space-y-2">
//                       <Label htmlFor="branchId">
//                         Branch <span className="text-red-500">*</span>
//                       </Label>
//                       <Select
//                         value={form.branchId}
//                         onValueChange={(value) =>
//                           handleSelectChange("branchId", value)
//                         }
//                       >
//                         <SelectTrigger>
//                           <SelectValue placeholder="Select branch" />
//                         </SelectTrigger>
//                         <SelectContent>
//                           {branches.map((branch) => (
//                             <SelectItem key={branch.id} value={branch.id}>
//                               {branch.name}
//                             </SelectItem>
//                           ))}
//                         </SelectContent>
//                       </Select>
//                     </div>
//                   ) : (
//                     <div className="space-y-2">
//                       <Label htmlFor="branchId">Branch</Label>
//                       <Input
//                         id="branchId"
//                         value={currentBranchName}
//                         disabled
//                         className="bg-muted"
//                       />
//                     </div>
//                   )}

//                   <div className="space-y-2">
//                     <Label htmlFor="institutionEmail">
//                       Institution Email <span className="text-red-500">*</span>
//                     </Label>
//                     <Input
//                       id="institutionEmail"
//                       name="institutionEmail"
//                       type="email"
//                       value={form.institutionEmail}
//                       onChange={handleChange}
//                       required
//                       placeholder="institution@example.com"
//                     />
//                   </div>

//                   <div className="space-y-2">
//                     <Label htmlFor="institutionPhone">
//                       Institution Phone <span className="text-red-500">*</span>
//                     </Label>
//                     <Input
//                       id="institutionPhone"
//                       name="institutionPhone"
//                       value={form.institutionPhone}
//                       onChange={handleChange}
//                       required
//                       placeholder="+256 700 000000"
//                     />
//                   </div>

//                   {mode === "create" && (
//                     <div className="space-y-2">
//                       <Label htmlFor="password">
//                         Password <span className="text-red-500">*</span>
//                       </Label>
//                       <Input
//                         id="password"
//                         name="password"
//                         type="password"
//                         value={form.password}
//                         onChange={handleChange}
//                         required
//                         placeholder="Enter secure password"
//                         minLength={6}
//                       />
//                     </div>
//                   )}
//                 </div>
//               </div>
//             )}

//             {/* Organization Background Tab */}
//             {activeTab === "background" && (
//               <div className="space-y-4">
//                 <h3 className="text-lg font-semibold flex items-center gap-2">
//                   <Building2 className="h-5 w-5" />
//                   Organization Background
//                 </h3>
//                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//                   <div className="space-y-2">
//                     <Label htmlFor="foundedDate">When was it founded?</Label>
//                     <Input
//                       id="foundedDate"
//                       name="foundedDate"
//                       type="date"
//                       value={form.foundedDate}
//                       onChange={handleChange}
//                     />
//                   </div>

//                   <div className="space-y-2">
//                     <Label htmlFor="founders">Founder(s)</Label>
//                     <Input
//                       id="founders"
//                       name="founders"
//                       value={form.founders}
//                       onChange={handleChange}
//                       placeholder="Names of founders"
//                     />
//                   </div>

//                   <div className="space-y-2">
//                     <Label htmlFor="legalStatus">Legal Status</Label>
//                     <Select
//                       value={form.legalStatus}
//                       onValueChange={(value) =>
//                         handleSelectChange("legalStatus", value)
//                       }
//                     >
//                       <SelectTrigger>
//                         <SelectValue placeholder="Select status" />
//                       </SelectTrigger>
//                       <SelectContent>
//                         {legalStatuses.map((status) => (
//                           <SelectItem key={status.value} value={status.value}>
//                             {status.label}
//                           </SelectItem>
//                         ))}
//                       </SelectContent>
//                     </Select>
//                   </div>

//                   <div className="space-y-2">
//                     <Label htmlFor="registrationNumber">
//                       Registration Number
//                     </Label>
//                     <Input
//                       id="registrationNumber"
//                       name="registrationNumber"
//                       value={form.registrationNumber}
//                       onChange={handleChange}
//                       placeholder="e.g., 9668/RCS"
//                     />
//                   </div>

//                   <div className="space-y-2">
//                     <Label htmlFor="tinNumber">TIN Number</Label>
//                     <Input
//                       id="tinNumber"
//                       name="tinNumber"
//                       value={form.tinNumber}
//                       onChange={handleChange}
//                       placeholder="Tax Identification Number"
//                     />
//                   </div>

//                   <div className="space-y-2">
//                     <Label htmlFor="yearEstablished">Year Established</Label>
//                     <Input
//                       id="yearEstablished"
//                       name="yearEstablished"
//                       type="number"
//                       value={form.yearEstablished}
//                       onChange={handleChange}
//                       placeholder="e.g., 2020"
//                       min="1900"
//                       max={new Date().getFullYear()}
//                     />
//                   </div>

//                   <div className="space-y-2">
//                     <Label htmlFor="businessSector">Business Sector</Label>
//                     <Input
//                       id="businessSector"
//                       name="businessSector"
//                       value={form.businessSector}
//                       onChange={handleChange}
//                       placeholder="e.g., Education, Healthcare"
//                     />
//                   </div>

//                   <div className="space-y-2">
//                     <Label htmlFor="numberOfEmployees">
//                       Number of Employees
//                     </Label>
//                     <Input
//                       id="numberOfEmployees"
//                       name="numberOfEmployees"
//                       type="number"
//                       value={form.numberOfEmployees}
//                       onChange={handleChange}
//                       placeholder="0"
//                       min="0"
//                     />
//                   </div>
//                 </div>

//                 <div className="space-y-2">
//                   <Label htmlFor="majorObjective">Major Objective</Label>
//                   <Textarea
//                     id="majorObjective"
//                     name="majorObjective"
//                     value={form.majorObjective}
//                     onChange={handleChange}
//                     placeholder="What is the main objective of your organization?"
//                     rows={3}
//                   />
//                 </div>

//                 <div className="space-y-2">
//                   <Label htmlFor="majorActivities">Major Activities</Label>
//                   <Textarea
//                     id="majorActivities"
//                     name="majorActivities"
//                     value={form.majorActivities}
//                     onChange={handleChange}
//                     placeholder="What are the main activities of your organization?"
//                     rows={3}
//                   />
//                 </div>
//               </div>
//             )}

//             {/* Primary Contact Tab */}
//             {activeTab === "contact" && (
//               <div className="space-y-4">
//                 <h3 className="text-lg font-semibold flex items-center gap-2">
//                   <Users className="h-5 w-5" />
//                   Primary Contact Person
//                 </h3>
//                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//                   <div className="space-y-2">
//                     <Label htmlFor="primaryContactPerson">
//                       Full Name <span className="text-red-500">*</span>
//                     </Label>
//                     <Input
//                       id="primaryContactPerson"
//                       name="primaryContactPerson"
//                       value={form.primaryContactPerson}
//                       onChange={handleChange}
//                       required
//                       placeholder="Enter contact person name"
//                     />
//                   </div>

//                   <div className="space-y-2">
//                     <Label htmlFor="primaryContactTitle">Title/Position</Label>
//                     <Input
//                       id="primaryContactTitle"
//                       name="primaryContactTitle"
//                       value={form.primaryContactTitle}
//                       onChange={handleChange}
//                       placeholder="e.g., Manager, Director"
//                     />
//                   </div>

//                   <div className="space-y-2">
//                     <Label htmlFor="primaryContactPhone">
//                       Phone <span className="text-red-500">*</span>
//                     </Label>
//                     <Input
//                       id="primaryContactPhone"
//                       name="primaryContactPhone"
//                       value={form.primaryContactPhone}
//                       onChange={handleChange}
//                       required
//                       placeholder="+256 700 000000"
//                     />
//                   </div>

//                   <div className="space-y-2">
//                     <Label htmlFor="primaryContactEmail">Email</Label>
//                     <Input
//                       id="primaryContactEmail"
//                       name="primaryContactEmail"
//                       type="email"
//                       value={form.primaryContactEmail}
//                       onChange={handleChange}
//                       placeholder="contact@example.com"
//                     />
//                   </div>
//                 </div>
//               </div>
//             )}

//             {/* Location Tab */}
//             {activeTab === "location" && (
//               <div className="space-y-4">
//                 <h3 className="text-lg font-semibold flex items-center gap-2">
//                   <MapPin className="h-5 w-5" />
//                   Location Details
//                 </h3>
//                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
//                   <div className="space-y-2">
//                     <Label htmlFor="plotNumber">Plot Number</Label>
//                     <Input
//                       id="plotNumber"
//                       name="plotNumber"
//                       value={form.plotNumber}
//                       onChange={handleChange}
//                       placeholder="Plot number"
//                     />
//                   </div>

//                   <div className="space-y-2">
//                     <Label htmlFor="street">Street</Label>
//                     <Input
//                       id="street"
//                       name="street"
//                       value={form.street}
//                       onChange={handleChange}
//                       placeholder="Street name"
//                     />
//                   </div>

//                   <div className="space-y-2">
//                     <Label htmlFor="village">Village/Cell</Label>
//                     <Input
//                       id="village"
//                       name="village"
//                       value={form.village}
//                       onChange={handleChange}
//                       placeholder="Village name"
//                     />
//                   </div>

//                   <div className="space-y-2">
//                     <Label htmlFor="parish">Parish/Ward</Label>
//                     <Input
//                       id="parish"
//                       name="parish"
//                       value={form.parish}
//                       onChange={handleChange}
//                       placeholder="Parish name"
//                     />
//                   </div>

//                   <div className="space-y-2">
//                     <Label htmlFor="subCounty">Sub County</Label>
//                     <Input
//                       id="subCounty"
//                       name="subCounty"
//                       value={form.subCounty}
//                       onChange={handleChange}
//                       placeholder="Sub county"
//                     />
//                   </div>

//                   <div className="space-y-2">
//                     <Label htmlFor="constituency">Constituency</Label>
//                     <Input
//                       id="constituency"
//                       name="constituency"
//                       value={form.constituency}
//                       onChange={handleChange}
//                       placeholder="Constituency"
//                     />
//                   </div>

//                   <div className="space-y-2">
//                     <Label htmlFor="town">Town</Label>
//                     <Input
//                       id="town"
//                       name="town"
//                       value={form.town}
//                       onChange={handleChange}
//                       placeholder="Town"
//                     />
//                   </div>

//                   <div className="space-y-2">
//                     <Label htmlFor="district">District</Label>
//                     <Input
//                       id="district"
//                       name="district"
//                       value={form.district}
//                       onChange={handleChange}
//                       placeholder="District"
//                     />
//                   </div>

//                   <div className="space-y-2 md:col-span-2 lg:col-span-3">
//                     <Label htmlFor="postalAddress">Postal Address</Label>
//                     <Textarea
//                       id="postalAddress"
//                       name="postalAddress"
//                       value={form.postalAddress}
//                       onChange={handleChange}
//                       placeholder="P.O. Box address"
//                       rows={2}
//                     />
//                   </div>
//                 </div>
//               </div>
//             )}

//             {/* Account Details Tab */}
//             {activeTab === "account" && (
//               <div className="space-y-4">
//                 <h3 className="text-lg font-semibold flex items-center gap-2">
//                   <CreditCard className="h-5 w-5" />
//                   Account & Banking Details
//                 </h3>
//                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//                   <div className="space-y-2">
//                     <Label htmlFor="accountTitle">Account Title</Label>
//                     <Input
//                       id="accountTitle"
//                       name="accountTitle"
//                       value={form.accountTitle}
//                       onChange={handleChange}
//                       placeholder="How should your account be titled?"
//                     />
//                   </div>

//                   <div className="space-y-2">
//                     <Label htmlFor="accountType">Type of Account</Label>
//                     <Select
//                       value={form.accountType}
//                       onValueChange={(value) =>
//                         handleSelectChange("accountType", value)
//                       }
//                     >
//                       <SelectTrigger>
//                         <SelectValue placeholder="Select account type" />
//                       </SelectTrigger>
//                       <SelectContent>
//                         {accountTypes.map((type) => (
//                           <SelectItem key={type.value} value={type.value}>
//                             {type.label}
//                           </SelectItem>
//                         ))}
//                       </SelectContent>
//                     </Select>
//                   </div>

//                   <div className="space-y-2">
//                     <Label htmlFor="bankName">Bank Name</Label>
//                     <Input
//                       id="bankName"
//                       name="bankName"
//                       value={form.bankName}
//                       onChange={handleChange}
//                       placeholder="Enter bank name"
//                     />
//                   </div>

//                   <div className="space-y-2">
//                     <Label htmlFor="bankAccountNumber">
//                       Bank Account Number
//                     </Label>
//                     <Input
//                       id="bankAccountNumber"
//                       name="bankAccountNumber"
//                       value={form.bankAccountNumber}
//                       onChange={handleChange}
//                       placeholder="Enter account number"
//                     />
//                   </div>
//                 </div>

//                 <div className="space-y-2">
//                   <Label htmlFor="operatingInstructions">
//                     Account Operating Instructions
//                   </Label>
//                   <Textarea
//                     id="operatingInstructions"
//                     name="operatingInstructions"
//                     value={form.operatingInstructions}
//                     onChange={handleChange}
//                     placeholder="Describe how the account should be operated (e.g., 'Any two signatories to sign')"
//                     rows={3}
//                   />
//                 </div>

//                 <div className="space-y-2">
//                   <Label htmlFor="signatoryChangeRules">
//                     Change of Signatory Instructions
//                   </Label>
//                   <Textarea
//                     id="signatoryChangeRules"
//                     name="signatoryChangeRules"
//                     value={form.signatoryChangeRules}
//                     onChange={handleChange}
//                     placeholder="Describe procedures for changing signatories"
//                     rows={3}
//                   />
//                 </div>
//               </div>
//             )}

//             {/* Administrators Tab */}
//             {activeTab === "administrators" && (
//               <div className="space-y-4">
//                 <div className="flex items-center justify-between">
//                   <h3 className="text-lg font-semibold flex items-center gap-2">
//                     <Users className="h-5 w-5" />
//                     Administrators/Signatories
//                   </h3>
//                   <Button
//                     type="button"
//                     variant="outline"
//                     size="sm"
//                     onClick={addAdministrator}
//                   >
//                     <Plus className="h-4 w-4 mr-2" />
//                     Add Administrator
//                   </Button>
//                 </div>

//                 <p className="text-sm text-muted-foreground">
//                   At least 2 administrators are required. Upload passport photos
//                   and signatures for each administrator.
//                 </p>

//                 <div className="space-y-4">
//                   {administrators.map((admin, index) => (
//                     <div
//                       key={index}
//                       className="rounded-lg border p-4 bg-muted/30 space-y-4"
//                     >
//                       <div className="flex items-center justify-between">
//                         <h4 className="font-medium flex items-center gap-2">
//                           <Users className="h-4 w-4" />
//                           Administrator {index + 1}
//                         </h4>
//                         {administrators.length > 2 && (
//                           <Button
//                             type="button"
//                             variant="destructive"
//                             size="sm"
//                             onClick={() => removeAdministrator(index)}
//                           >
//                             <Trash2 className="h-4 w-4 mr-2" />
//                             Remove
//                           </Button>
//                         )}
//                       </div>

//                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//                         <div className="space-y-2">
//                           <Label>
//                             Full Name{" "}
//                             {index < 2 && (
//                               <span className="text-red-500">*</span>
//                             )}
//                           </Label>
//                           <Input
//                             value={admin.name}
//                             onChange={(e) =>
//                               handleAdministratorChange(
//                                 index,
//                                 "name",
//                                 e.target.value
//                               )
//                             }
//                             placeholder="Full name"
//                           />
//                         </div>

//                         <div className="space-y-2">
//                           <Label>
//                             Position/Post{" "}
//                             {index < 2 && (
//                               <span className="text-red-500">*</span>
//                             )}
//                           </Label>
//                           <Input
//                             value={admin.post}
//                             onChange={(e) =>
//                               handleAdministratorChange(
//                                 index,
//                                 "post",
//                                 e.target.value
//                               )
//                             }
//                             placeholder="e.g., Chairperson, Secretary"
//                           />
//                         </div>

//                         <div className="space-y-2">
//                           <Label>Mobile Number</Label>
//                           <Input
//                             value={admin.phone}
//                             onChange={(e) =>
//                               handleAdministratorChange(
//                                 index,
//                                 "phone",
//                                 e.target.value
//                               )
//                             }
//                             placeholder="+256 700 000000"
//                           />
//                         </div>

//                         <div className="space-y-2">
//                           <Label>Email Address</Label>
//                           <Input
//                             type="email"
//                             value={admin.email || ""}
//                             onChange={(e) =>
//                               handleAdministratorChange(
//                                 index,
//                                 "email",
//                                 e.target.value
//                               )
//                             }
//                             placeholder="email@example.com"
//                           />
//                         </div>
//                       </div>

//                       {/* Photo and Signature Upload */}
//                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//                         {/* Photo Capture */}
//                         <div className="space-y-2">
//                           <Label>Passport Photo</Label>
//                           <div className="flex flex-col gap-2">
//                             {admin.photo ? (
//                               <div className="relative w-32 h-32 mx-auto">
//                                 <img
//                                   src={admin.photo}
//                                   alt="Administrator photo"
//                                   className="w-full h-full object-cover rounded border-2 border-primary"
//                                 />
//                                 <button
//                                   type="button"
//                                   onClick={() => {
//                                     const newAdmins = [...administrators];
//                                     newAdmins[index].photo = undefined;
//                                     setAdministrators(newAdmins);
//                                   }}
//                                   className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1.5 shadow-lg hover:bg-destructive/90"
//                                 >
//                                   <X className="h-3 w-3" />
//                                 </button>
//                               </div>
//                             ) : (
//                               <Button
//                                 type="button"
//                                 variant="outline"
//                                 onClick={() => openCamera(index, "photo")}
//                                 className="w-full h-32 border-2 border-dashed hover:border-primary"
//                               >
//                                 <div className="flex flex-col items-center gap-2">
//                                   <Camera className="h-8 w-8" />
//                                   <span className="text-sm">Take Photo</span>
//                                 </div>
//                               </Button>
//                             )}
//                             <p className="text-xs text-muted-foreground text-center">
//                               Passport size photo required
//                             </p>
//                           </div>
//                         </div>

//                         {/* Signature Capture/Input */}
//                         <div className="space-y-2">
//                           <Label>Signature</Label>
//                           <div className="space-y-2">
//                             {admin.signature?.startsWith("data:image") ||
//                             admin.signature?.startsWith("http") ? (
//                               <div className="relative">
//                                 <div className="border-2 border-primary rounded-lg p-4 bg-white">
//                                   <img
//                                     src={admin.signature}
//                                     alt="Signature"
//                                     className="h-24 w-full object-contain"
//                                   />
//                                 </div>
//                                 <button
//                                   type="button"
//                                   onClick={() => {
//                                     const newAdmins = [...administrators];
//                                     newAdmins[index].signature = "";
//                                     setAdministrators(newAdmins);
//                                   }}
//                                   className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1.5 shadow-lg hover:bg-destructive/90"
//                                 >
//                                   <X className="h-3 w-3" />
//                                 </button>
//                               </div>
//                             ) : (
//                               <>
//                                 <Button
//                                   type="button"
//                                   variant="outline"
//                                   onClick={() => openCamera(index, "signature")}
//                                   className="w-full border-2 border-dashed hover:border-primary"
//                                 >
//                                   <Camera className="h-4 w-4 mr-2" />
//                                   Capture Signature
//                                 </Button>
//                                 <div className="relative">
//                                   <div className="absolute inset-0 flex items-center">
//                                     <span className="w-full border-t" />
//                                   </div>
//                                   <div className="relative flex justify-center text-xs uppercase">
//                                     <span className="bg-background px-2 text-muted-foreground">
//                                       Or type signature
//                                     </span>
//                                   </div>
//                                 </div>
//                                 <Input
//                                   value={admin.signature || ""}
//                                   onChange={(e) =>
//                                     handleAdministratorChange(
//                                       index,
//                                       "signature",
//                                       e.target.value
//                                     )
//                                   }
//                                   placeholder="Type full name as signature"
//                                   className="font-serif text-lg italic"
//                                 />
//                               </>
//                             )}
//                           </div>
//                         </div>
//                       </div>
//                     </div>
//                   ))}
//                 </div>
//               </div>
//             )}

//             {/* Financial Tab */}
//             {activeTab === "financial" && (
//               <div className="space-y-4">
//                 <h3 className="text-lg font-semibold flex items-center gap-2">
//                   <CreditCard className="h-5 w-5" />
//                   Financial Commitment
//                 </h3>
//                 <div className="p-4 bg-muted rounded-lg">
//                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//                     <div className="space-y-2">
//                       <Label htmlFor="entryFee">Entry Fee (UGX)</Label>
//                       <Input
//                         id="entryFee"
//                         name="entryFee"
//                         type="number"
//                         step="1000"
//                         value={form.entryFee}
//                         onChange={handleChange}
//                         placeholder="30000"
//                       />
//                       <p className="text-xs text-muted-foreground">
//                         Standard entry fee
//                       </p>
//                     </div>

//                     <div className="space-y-2">
//                       <Label htmlFor="initialDeposit">
//                         Initial Deposit (UGX)
//                       </Label>
//                       <Input
//                         id="initialDeposit"
//                         name="initialDeposit"
//                         type="number"
//                         step="1000"
//                         value={form.initialDeposit}
//                         onChange={handleChange}
//                         placeholder="20000"
//                       />
//                       <p className="text-xs text-muted-foreground">
//                         Minimum UGX 20,000
//                       </p>
//                     </div>
//                   </div>
//                 </div>

//                 <div className="space-y-2">
//                   <Label htmlFor="description">Institution Description</Label>
//                   <Textarea
//                     id="description"
//                     name="description"
//                     value={form.description}
//                     onChange={handleChange}
//                     placeholder="Brief description of the institution"
//                     rows={3}
//                   />
//                 </div>

//                 <div className="space-y-2">
//                   <Label htmlFor="notes">Additional Notes</Label>
//                   <Textarea
//                     id="notes"
//                     name="notes"
//                     value={form.notes}
//                     onChange={handleChange}
//                     placeholder="Any additional notes or comments"
//                     rows={3}
//                   />
//                 </div>
//               </div>
//             )}
//           </div>
//         </form>

//         <DialogFooter className="border-t pt-4">
//           <div className="flex items-center justify-between w-full">
//             <p className="text-sm text-muted-foreground">
//               {administrators.filter((a) => a.name && a.post).length}/
//               {administrators.length} administrators completed
//             </p>
//             <div className="flex gap-2">
//               <Button
//                 type="button"
//                 variant="outline"
//                 onClick={onClose}
//                 disabled={isSubmitting}
//               >
//                 Cancel
//               </Button>
//               <Button
//                 type="submit"
//                 disabled={isSubmitting}
//                 onClick={handleSubmit}
//               >
//                 {isSubmitting
//                   ? mode === "create"
//                     ? "Creating..."
//                     : "Updating..."
//                   : mode === "create"
//                     ? "Create Institution"
//                     : "Update Institution"}
//               </Button>
//             </div>
//           </div>
//         </DialogFooter>
//       </DialogContent>

//       {/* Camera Modal */}
//       {isCameraOpen && (
//         <Dialog open={isCameraOpen} onOpenChange={() => closeCamera()}>
//           <DialogContent className="max-w-3xl">
//             <DialogHeader>
//               <DialogTitle>
//                 {currentCameraIndex?.field === "photo"
//                   ? "Take Passport Photo"
//                   : "Capture Signature"}
//               </DialogTitle>
//               <DialogDescription>
//                 {capturedPreview
//                   ? "Review your captured image and confirm or retake"
//                   : "Position yourself in the center and click capture when ready"}
//               </DialogDescription>
//             </DialogHeader>
//             <div className="space-y-4">
//               {capturedPreview ? (
//                 // Preview Mode
//                 <div className="space-y-4">
//                   <div className="relative bg-gray-100 rounded-lg overflow-hidden p-4">
//                     <img
//                       src={capturedPreview}
//                       alt="Preview"
//                       className="w-full h-auto max-h-96 object-contain mx-auto rounded border-2 border-primary"
//                     />
//                   </div>
//                   <div className="flex gap-2 justify-center">
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
//                       onClick={() => uploadToUploadThing(capturedPreview)}
//                       disabled={isUploading}
//                       className="gap-2"
//                     >
//                       {isUploading ? (
//                         <>
//                           <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
//                           Uploading...
//                         </>
//                       ) : (
//                         <>
//                           <Camera className="h-4 w-4" />
//                           Confirm & Upload
//                         </>
//                       )}
//                     </Button>
//                   </div>
//                 </div>
//               ) : (
//                 // Camera Mode
//                 <>
//                   <div className="relative bg-black rounded-lg overflow-hidden">
//                     <video
//                       ref={videoRef}
//                       autoPlay
//                       playsInline
//                       className="w-full h-auto"
//                     />
//                     <div className="absolute inset-0 border-4 border-dashed border-white/30 m-4 rounded-lg pointer-events-none" />
//                     {currentCameraIndex?.field === "photo" && (
//                       <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-56 border-4 border-green-400 rounded-lg pointer-events-none">
//                         <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-green-400 text-white text-xs px-2 py-1 rounded">
//                           Position Face Here
//                         </div>
//                       </div>
//                     )}
//                   </div>
//                   <div className="flex gap-2 justify-center">
//                     <Button
//                       type="button"
//                       variant="outline"
//                       onClick={closeCamera}
//                     >
//                       Cancel
//                     </Button>
//                     <Button
//                       type="button"
//                       onClick={capturePhoto}
//                       className="gap-2"
//                     >
//                       <Camera className="h-4 w-4" />
//                       Capture
//                     </Button>
//                   </div>
//                 </>
//               )}
//             </div>
//           </DialogContent>
//         </Dialog>
//       )}
//     </Dialog>
//   );
// }

// app/dashboard/users/institutions/components/InstitutionFormModal.tsx
// app/dashboard/users/institutions/components/InstitutionFormModal.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { Branch, UserRole } from "@prisma/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  Building2,
  Users,
  MapPin,
  CreditCard,
  Camera,
  X,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import SearchableSelect from "react-tailwindcss-select";
import type {
  Option as SelectOption,
  Options as SelectOptions,
} from "react-tailwindcss-select/dist/components/type";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  BUKONZO_EAST_CONSTITUENCIES,
  getBukonzoEastConstituencyNames,
  getBukonzoEastParishes,
  getBukonzoEastVillages,
} from "@/lib/location/bukonzo-east";
import { useUploadThing } from "@/lib/uploadthing";

interface Administrator {
  name: string;
  post: string;
  phone: string;
  email?: string;
  photo?: string;
  signature?: string;
}

interface InstitutionFormData {
  institutionName: string;
  institutionType: string;
  institutionPhone: string;
  institutionEmail: string;
  branchId: string;
  password: string;
  foundedDate?: string;
  founders?: string;
  majorObjective?: string;
  majorActivities?: string;
  legalStatus?: string;
  registrationNumber?: string;
  tinNumber?: string;
  yearEstablished?: string;
  businessSector?: string;
  numberOfEmployees?: string;
  primaryContactPerson: string;
  primaryContactPhone: string;
  primaryContactEmail?: string;
  primaryContactTitle?: string;
  plotNumber?: string;
  street?: string;
  village?: string;
  parish?: string;
  subCounty?: string;
  constituency?: string;
  town?: string;
  district?: string;
  postalAddress?: string;
  accountTitle?: string;
  accountType?: string;
  operatingInstructions?: string;
  signatoryChangeRules?: string;
  bankName?: string;
  bankAccountNumber?: string;
  entryFee?: string;
  initialDeposit?: string;
  description?: string;
  notes?: string;
}

type LocationCatalogParish = {
  id: string;
  name: string;
  subCountyId: string;
  villages: Array<{ id: string; name: string; parishId: string }>;
};

type LocationCatalogSubCounty = {
  id: string;
  name: string;
  constituencyId: string;
  parishes: LocationCatalogParish[];
};

type LocationCatalogConstituency = {
  id: string;
  name: string;
  subCounties: LocationCatalogSubCounty[];
};

interface InstitutionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: "create" | "edit";
  initial?: any;
  branches: Branch[];
  branchId?: string;
  role?: UserRole;
}

type CameraDevice = {
  deviceId: string;
  label: string;
};

const organizationTypes = [
  { label: "School", value: "SCHOOL" },
  { label: "Hospital", value: "HOSPITAL" },
  { label: "Clinic", value: "CLINIC" },
  { label: "Company", value: "COMPANY" },
  { label: "Government", value: "GOVERNMENT" },
  { label: "NGO", value: "NGO" },
  { label: "Cooperative", value: "COOPERATIVE" },
  { label: "Association", value: "ASSOCIATION" },
  { label: "Religious Organization", value: "RELIGIOUS" },
  { label: "Community Group", value: "COMMUNITY" },
  { label: "Other", value: "OTHER" },
];

const legalStatuses = [
  { label: "Village Level", value: "VILLAGE" },
  { label: "Sub County Level", value: "SUBCOUNTY" },
  { label: "District Level", value: "DISTRICT" },
  { label: "National Level", value: "NATIONAL" },
  { label: "International", value: "INTERNATIONAL" },
];

const accountTypes = [
  { label: "Savings Account", value: "SAVINGS" },
  { label: "Current Account", value: "CURRENT" },
  { label: "Fixed Deposit", value: "FIXED_DEPOSIT" },
];

export default function InstitutionFormModal({
  isOpen,
  onClose,
  mode,
  initial,
  branches,
  branchId,
  role,
}: InstitutionFormModalProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<
    | "basic"
    | "background"
    | "contact"
    | "location"
    | "account"
    | "administrators"
    | "financial"
  >("basic");

  const [administrators, setAdministrators] = useState<Administrator[]>([
    { name: "", post: "", phone: "", email: "" },
    { name: "", post: "", phone: "", email: "" },
  ]);

  const [phone, setPhone] = useState("+256 ");

  // const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  //   let value = e.target.value;

  //   // Prevent deletion of the country code
  //   if (!value.startsWith("+256")) {
  //     value = "+256 ";
  //   }

  //   setPhone(value);
  // };

  // Camera refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const photoInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const signatureInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [currentCameraIndex, setCurrentCameraIndex] = useState<{
    adminIndex: number;
    field: "photo" | "signature";
  } | null>(null);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [availableCameras, setAvailableCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  // Use the dedicated institution upload endpoints so camera capture works
  // for both passport photos and signatures.
  const {
    startUpload: startPhotoUpload,
    isUploading: isPhotoUploading,
  } = useUploadThing("institutionAdminPhoto");
  const {
    startUpload: startSignatureUpload,
    isUploading: isSignatureUploading,
  } = useUploadThing("institutionAdminSignature");
  const isUploading = isPhotoUploading || isSignatureUploading;

  const [form, setForm] = useState<InstitutionFormData>({
    institutionName: "",
    institutionType: "SCHOOL",
    institutionPhone: "",
    institutionEmail: "",
    primaryContactPerson: "",
    primaryContactPhone: "",
    branchId: branchId || "",
    password: "",
    primaryContactEmail: "",
    primaryContactTitle: "",
    foundedDate: "",
    founders: "",
    majorObjective: "",
    majorActivities: "",
    legalStatus: "",
    registrationNumber: "",
    tinNumber: "",
    yearEstablished: "",
    businessSector: "",
    numberOfEmployees: "",
    plotNumber: "",
    street: "",
    village: "",
    parish: "",
    subCounty: "",
    constituency: "",
    town: "",
    district: "Kasese",
    postalAddress: "",
    accountTitle: "",
    accountType: "",
    operatingInstructions: "",
    signatoryChangeRules: "",
    bankName: "",
    bankAccountNumber: "",
    entryFee: "30000",
    initialDeposit: "20000",
    description: "",
    notes: "",
  });
  const [locationCatalog, setLocationCatalog] = useState<LocationCatalogConstituency[]>([]);
  const [districtCatalog, setDistrictCatalog] = useState<string[]>(["Kasese"]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [locationDialogType, setLocationDialogType] = useState<
    "constituency" | "subCounty" | "parish" | "village" | null
  >(null);
  const [locationDraft, setLocationDraft] = useState("");

  useEffect(() => {
    if (mode === "edit" && initial) {
      setForm({
        institutionName: initial.institutionName || "",
        institutionType: initial.institutionType || "SCHOOL",
        institutionPhone: initial.institutionPhone || "",
        institutionEmail: initial.institutionEmail || "",
        primaryContactPerson: initial.primaryContactPerson || "",
        primaryContactPhone: initial.primaryContactPhone || "",
        branchId: initial.user?.branchId || branchId || "",
        password: "",
        primaryContactEmail: initial.primaryContactEmail || "",
        primaryContactTitle: initial.primaryContactTitle || "",
        foundedDate: initial.foundedDate || "",
        founders: initial.founders || "",
        majorObjective: initial.majorObjective || "",
        majorActivities: initial.majorActivities || "",
        legalStatus: initial.legalStatus || "",
        registrationNumber: initial.registrationNumber || "",
        tinNumber: initial.tinNumber || "",
        yearEstablished: initial.yearEstablished?.toString() || "",
        businessSector: initial.businessSector || "",
        numberOfEmployees: initial.numberOfEmployees?.toString() || "",
        plotNumber: initial.plotNumber || "",
        street: initial.street || "",
        village: initial.village || "",
        parish: initial.parish || "",
        subCounty: initial.subCounty || "",
        constituency: initial.constituency || "",
        town: initial.town || "",
        district: initial.district || "Kasese",
        postalAddress: initial.postalAddress || "",
        accountTitle: initial.accountTitle || "",
        accountType: initial.accountType || "",
        operatingInstructions: initial.operatingInstructions || "",
        signatoryChangeRules: initial.signatoryChangeRules || "",
        bankName: initial.bankName || "",
        bankAccountNumber: initial.bankAccountNumber || "",
        entryFee: initial.entryFee?.toString() || "30000",
        initialDeposit: initial.initialDeposit?.toString() || "20000",
        description: initial.description || "",
        notes: initial.notes || "",
      });

      if (initial.administrators && Array.isArray(initial.administrators)) {
        setAdministrators(
          initial.administrators.length > 0
            ? initial.administrators
            : [
                { name: "", post: "", phone: "", email: "" },
                { name: "", post: "", phone: "", email: "" },
              ]
        );
      }
    } else {
      setForm((prev) => ({
        ...prev,
        branchId: branchId || "",
      }));
    }
  }, [mode, initial, branchId]);

  useEffect(() => {
    const fetchLocationCatalog = async () => {
      try {
        setLocationLoading(true);
        const response = await fetch("/api/v1/location-catalog");
        const result = await response.json();
        if (!response.ok || !result?.success) {
          throw new Error(result?.error || "Failed to load location catalog");
        }
        setLocationCatalog(result.data || []);
        setDistrictCatalog(
          (result.districts || []).map((district: { name: string }) => district.name) || ["Kasese"],
        );
      } catch (error) {
        console.error("Error fetching location catalog:", error);
        setDistrictCatalog(["Kasese"]);
        setLocationCatalog(
          BUKONZO_EAST_CONSTITUENCIES.map((constituency, constituencyIndex) => ({
            id: `fallback-${constituencyIndex}`,
            name: constituency.name,
            subCounties: constituency.subCounties.map((subCounty, subCountyIndex) => ({
              id: `fallback-${constituencyIndex}-${subCountyIndex}`,
              name: subCounty.name,
              constituencyId: `fallback-${constituencyIndex}`,
              parishes: subCounty.parishes.map((parish, parishIndex) => ({
                id: `fallback-${constituencyIndex}-${subCountyIndex}-${parishIndex}`,
                name: parish,
                subCountyId: `fallback-${constituencyIndex}-${subCountyIndex}`,
                villages: [],
              })),
            })),
          })),
        );
      } finally {
        setLocationLoading(false);
      }
    };

    if (isOpen) {
      void fetchLocationCatalog();
    }
  }, [isOpen]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));

    let countrycode = e.target.value;

    // Prevent deletion of the country code
    if (!countrycode.startsWith("+256")) {
      countrycode = "+256 ";
    }

    setPhone(value);
  };

  const handleSelectChange = (name: string, value: string) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const constituencyOptions: SelectOptions = (
    locationCatalog.length ? locationCatalog.map((entry) => entry.name) : getBukonzoEastConstituencyNames()
  ).map((name) => ({
    label: name,
    value: name,
  }));
  const currentConstituencyRecord =
    locationCatalog.find((entry) => entry.name === form.constituency) || null;
  const subCountyOptions: SelectOptions = (
    currentConstituencyRecord?.subCounties.map((entry) => entry.name) || []
  ).map((name) => ({
    label: name,
    value: name,
  }));
  const currentSubCountyRecord =
    currentConstituencyRecord?.subCounties.find((entry) => entry.name === form.subCounty) || null;
  const parishOptions: SelectOptions = (
    currentSubCountyRecord?.parishes.map((entry) => entry.name) ||
    getBukonzoEastParishes(form.constituency, form.subCounty)
  ).map((name) => ({
    label: name,
    value: name,
  }));
  const currentParishRecord =
    currentSubCountyRecord?.parishes.find((entry) => entry.name === form.parish) || null;
  const villageOptions: SelectOptions = (
    currentParishRecord?.villages?.length
      ? currentParishRecord.villages.map((entry) => entry.name)
      : getBukonzoEastVillages(form.constituency, form.subCounty, form.parish)
  ).map((name) => ({
    label: name,
    value: name,
  }));
  const selectedConstituencyOption: SelectOption | null = form.constituency
    ? { label: form.constituency, value: form.constituency }
    : null;
  const selectedSubCountyOption: SelectOption | null = form.subCounty
    ? { label: form.subCounty, value: form.subCounty }
    : null;
  const selectedParishOption: SelectOption | null = form.parish
    ? { label: form.parish, value: form.parish }
    : null;
  const selectedVillageOption: SelectOption | null = form.village
    ? { label: form.village, value: form.village }
    : null;
  const districtOptions: SelectOptions = districtCatalog.map((name) => ({
    label: name,
    value: name,
  }));
  const selectedDistrictOption: SelectOption | null = form.district
    ? { label: form.district, value: form.district }
    : null;

  const confirmLocationCreation = () => {
    const value = locationDraft.trim();
    if (!value) {
      toast.error(
        locationDialogType === "district"
          ? "Enter a district name"
          : locationDialogType === "constituency"
          ? "Enter a constituency name"
          : locationDialogType === "subCounty"
          ? "Enter a sub county or town council name"
          : locationDialogType === "parish"
          ? "Enter a parish or ward name"
          : "Enter a village name",
      );
      return;
    }

    void (async () => {
      try {
        setLocationLoading(true);

        if (locationDialogType === "district") {
          const response = await fetch("/api/v1/location-catalog", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ kind: "district", name: value }),
          });
          const result = await response.json();
          if (!response.ok || !result?.success) {
            throw new Error(result?.error || "Failed to create district");
          }

          setDistrictCatalog((current) => {
            const next = current.filter((item) => item !== result.data.name);
            return [...next, result.data.name].sort((a, b) => a.localeCompare(b));
          });
          setForm((prev) => ({
            ...prev,
            district: result.data.name,
          }));
        } else if (locationDialogType === "constituency") {
          const response = await fetch("/api/v1/location-catalog", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ kind: "constituency", name: value }),
          });
          const result = await response.json();
          if (!response.ok || !result?.success) {
            throw new Error(result?.error || "Failed to create constituency");
          }

          setLocationCatalog((current) => {
            const next = current.filter((entry) => entry.name !== result.data.name);
            return [...next, result.data].sort((a, b) => a.name.localeCompare(b.name));
          });
          setForm((prev) => ({
            ...prev,
            constituency: result.data.name,
            subCounty: "",
            parish: "",
            village: "",
          }));
        } else if (locationDialogType === "subCounty") {
          if (!form.constituency) {
            throw new Error("Select or create a constituency first, then create the sub county or town council.");
          }

          const response = await fetch("/api/v1/location-catalog", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              kind: "subCounty",
              name: value,
              constituencyName: form.constituency,
            }),
          });
          const result = await response.json();
          if (!response.ok || !result?.success) {
            throw new Error(result?.error || "Failed to create sub county");
          }

          setLocationCatalog((current) =>
            current.map((entry) =>
              entry.name === form.constituency
                ? {
                    ...entry,
                    subCounties: [
                      ...entry.subCounties.filter((subCounty) => subCounty.name !== result.data.name),
                      result.data,
                    ].sort((a, b) => a.name.localeCompare(b.name)),
                  }
                : entry,
            ),
          );
          setForm((prev) => ({
            ...prev,
            subCounty: result.data.name,
            parish: "",
            village: "",
          }));
        } else if (locationDialogType === "parish") {
          if (!form.constituency) {
            throw new Error("Select or create a constituency first, then create the parish or ward.");
          }
          if (!form.subCounty) {
            throw new Error("Select or create a sub county first, then create the parish or ward.");
          }

          const response = await fetch("/api/v1/location-catalog", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              kind: "parish",
              name: value,
              constituencyName: form.constituency,
              subCountyName: form.subCounty,
            }),
          });
          const result = await response.json();
          if (!response.ok || !result?.success) {
            throw new Error(result?.error || "Failed to create parish");
          }

          setLocationCatalog((current) =>
            current.map((entry) =>
              entry.name === form.constituency
                ? {
                    ...entry,
                    subCounties: entry.subCounties.map((subCounty) =>
                      subCounty.name === form.subCounty
                        ? {
                            ...subCounty,
                            parishes: [
                              ...subCounty.parishes.filter((parish) => parish.name !== result.data.name),
                              { ...result.data, villages: [] },
                            ].sort((a, b) => a.name.localeCompare(b.name)),
                          }
                        : subCounty,
                    ),
                  }
                : entry,
            ),
          );
          setForm((prev) => ({
            ...prev,
            parish: result.data.name,
            village: "",
          }));
        } else {
          if (!form.constituency) {
            throw new Error("Select or create a constituency first, then create the village.");
          }
          if (!form.subCounty) {
            throw new Error("Select or create a sub county first, then create the village.");
          }
          if (!form.parish) {
            throw new Error("Select or create a parish first, then create the village.");
          }

          const response = await fetch("/api/v1/location-catalog", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              kind: "village",
              name: value,
              constituencyName: form.constituency,
              subCountyName: form.subCounty,
              parishName: form.parish,
            }),
          });
          const result = await response.json();
          if (!response.ok || !result?.success) {
            throw new Error(result?.error || "Failed to create village");
          }

          setLocationCatalog((current) =>
            current.map((entry) =>
              entry.name === form.constituency
                ? {
                    ...entry,
                    subCounties: entry.subCounties.map((subCounty) =>
                      subCounty.name === form.subCounty
                        ? {
                            ...subCounty,
                            parishes: subCounty.parishes.map((parish) =>
                              parish.name === form.parish
                                ? {
                                    ...parish,
                                    villages: [
                                      ...parish.villages.filter((village) => village.name !== result.data.name),
                                      result.data,
                                    ].sort((a, b) => a.name.localeCompare(b.name)),
                                  }
                                : parish,
                            ),
                          }
                        : subCounty,
                    ),
                  }
                : entry,
            ),
          );
          setForm((prev) => ({
            ...prev,
            village: result.data.name,
          }));
        }

        setLocationDialogOpen(false);
        setLocationDialogType(null);
        setLocationDraft("");
        toast.success("Location saved");
      } catch (error: any) {
        toast.error(error?.message || "Failed to save location");
      } finally {
        setLocationLoading(false);
      }
    })();
  };

  const handleAdministratorChange = (
    index: number,
    field: keyof Administrator,
    value: string
  ) => {
    const newAdmins = [...administrators];
    newAdmins[index][field] = value;
    setAdministrators(newAdmins);
  };

  const loadAvailableCameras = async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) {
        return;
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices
        .filter((device) => device.kind === "videoinput")
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${index + 1}`,
        }));

      setAvailableCameras(cameras);
    } catch (error) {
      console.error("Error listing cameras:", error);
    }
  };

  const startCamera = async (
    index: number,
    field: "photo" | "signature",
    deviceId?: string
  ) => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        toast.error("Camera is not supported in this browser.");
        return;
      }

      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
        setCameraStream(null);
      }

      const constraints = deviceId
        ? {
            video: {
              deviceId: { exact: deviceId },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          }
        : {
            video: {
              facingMode: "user",
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      setCameraStream(stream);
      setCurrentCameraIndex({ adminIndex: index, field });
      setIsCameraOpen(true);
      setCapturedPreview(null);
      setIsCameraReady(false);

      const [track] = stream.getVideoTracks();
      const currentDeviceId = track?.getSettings().deviceId || deviceId || "";
      if (currentDeviceId) {
        setSelectedCameraId(currentDeviceId);
      }

      await loadAvailableCameras();
    } catch (error) {
      console.error("Error accessing camera:", error);
      const errorName = error instanceof DOMException ? error.name : "";
      const message =
        errorName === "NotAllowedError"
          ? "Camera access was blocked. Please allow permissions and try again."
          : errorName === "NotReadableError"
            ? "That camera is busy or cannot be started. Close any other app using it and try again."
            : errorName === "NotFoundError" || errorName === "OverconstrainedError"
              ? "That camera could not be opened. Try another camera source."
              : errorName === "AbortError"
                ? "The camera switch was interrupted. Please try again."
                : "Unable to access camera. Please check permissions.";
      toast.error(message);
    }
  };

  const openCamera = async (index: number, field: "photo" | "signature") => {
    await startCamera(index, field, selectedCameraId || undefined);
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
    setCurrentCameraIndex(null);
    setCapturedPreview(null);
    setIsCameraReady(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !currentCameraIndex || !isCameraReady) {
      toast.error("Please wait for the camera to finish loading.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (!canvas.width || !canvas.height) {
      toast.error("Camera frame is not ready yet. Try again in a moment.");
      return;
    }

    ctx.drawImage(videoRef.current, 0, 0);
    const base64Image = canvas.toDataURL("image/jpeg", 0.9);

    setCapturedPreview(base64Image);
  };

  const uploadImage = async (
    file: File,
    field: "photo" | "signature"
  ): Promise<string | null> => {
    const fileToDataUrl = () =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });

    try {
      // Validate file
      if (file.size > 2 * 1024 * 1024) {
        toast.error("File size must be less than 2MB");
        return null;
      }

      const validTypes = ["image/jpeg", "image/jpg", "image/png"];
      if (!validTypes.includes(file.type)) {
        toast.error("Only JPG, JPEG, and PNG files are allowed");
        return null;
      }

      const startUpload =
        field === "photo" ? startPhotoUpload : startSignatureUpload;
      const uploadPromise = startUpload([file]);
      const timeoutPromise = new Promise<never>((_, reject) => {
        window.setTimeout(() => {
          reject(new Error("Upload timed out"));
        }, 20000);
      });

      const res = await Promise.race([uploadPromise, timeoutPromise]);
      const uploadedUrl = res?.[0]?.url;

      if (!uploadedUrl) {
        throw new Error("Upload failed - no URL returned");
      }

      return uploadedUrl;
    } catch (error) {
      console.error("UploadThing error:", error);
      if (field === "photo") {
        toast.warning("Photo upload fell back to local storage.");
      } else {
        toast.warning("Signature upload fell back to local storage.");
      }
      try {
        return await fileToDataUrl();
      } catch (fallbackError) {
        console.error("Local file fallback failed:", fallbackError);
        toast.error("Upload failed. Please try again.");
        return null;
      }
    }
  };

  const uploadCapturedImage = async (base64Image: string) => {
    if (!currentCameraIndex) return;

    try {
      // Convert base64 to blob then to file
      const response = await fetch(base64Image);
      const blob = await response.blob();

      const fieldType =
        currentCameraIndex.field === "photo" ? "photo" : "signature";
      const fileName = `institution_admin_${fieldType}_${Date.now()}.jpg`;
      const file = new File([blob], fileName, { type: "image/jpeg" });

      // Upload to UploadThing
      const uploadedUrl = await uploadImage(file, currentCameraIndex.field);

      if (uploadedUrl) {
        const newAdmins = [...administrators];
        newAdmins[currentCameraIndex.adminIndex][currentCameraIndex.field] =
          uploadedUrl;
        setAdministrators(newAdmins);

        closeCamera();
        toast.success(
          `${currentCameraIndex.field === "photo" ? "Photo" : "Signature"} uploaded successfully!`
        );
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Upload failed. Please try again.");
    }
  };

  const handleCameraChange = async (deviceId: string) => {
    if (!currentCameraIndex) {
      return;
    }

    setSelectedCameraId(deviceId);
    setCapturedPreview(null);
    setIsCameraReady(false);
    await startCamera(
      currentCameraIndex.adminIndex,
      currentCameraIndex.field,
      deviceId || undefined
    );
  };

  const handleFileSelect = async (
    index: number,
    field: "photo" | "signature",
    file: File
  ) => {
    if (!file) return;

    const uploadedUrl = await uploadImage(file, field);

    if (uploadedUrl) {
      const newAdmins = [...administrators];
      newAdmins[index][field] = uploadedUrl;
      setAdministrators(newAdmins);
      toast.success(
        `${field === "photo" ? "Photo" : "Signature"} uploaded successfully!`
      );
    }
  };

  const handleDrop = (
    e: React.DragEvent,
    index: number,
    field: "photo" | "signature"
  ) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(index, field, files[0]);
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
    if (!isCameraOpen || !cameraStream || !videoRef.current) {
      return;
    }

    const video = videoRef.current;
    let cancelled = false;
    let started = false;

    const attachStream = async () => {
      if (started) {
        return;
      }
      started = true;

      try {
        video.srcObject = cameraStream;
        await video.play();
        if (!cancelled) {
          setIsCameraReady(true);
        }
      } catch (error) {
        console.error("Error playing video:", error);
        if (!cancelled) {
          const errorName = error instanceof DOMException ? error.name : "";
          if (errorName !== "AbortError") {
            toast.error("Failed to start video stream");
          }
        }
      }
    };

    const handleCanPlay = () => {
      void attachStream();
    };

    video.srcObject = cameraStream;
    video.addEventListener("loadedmetadata", handleCanPlay, { once: true });
    video.addEventListener("canplay", handleCanPlay, { once: true });

    if (video.readyState >= 1) {
      void attachStream();
    }

    return () => {
      cancelled = true;
      video.removeEventListener("loadedmetadata", handleCanPlay);
      video.removeEventListener("canplay", handleCanPlay);
    };
  }, [isCameraOpen, cameraStream]);

  const addAdministrator = () => {
    setAdministrators([
      ...administrators,
      { name: "", post: "", phone: "", email: "" },
    ]);
  };

  const removeAdministrator = (index: number) => {
    if (administrators.length > 2) {
      setAdministrators(administrators.filter((_, i) => i !== index));
    } else {
      toast.error("At least 2 administrators are required");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validation
      if (!form.institutionName.trim()) {
        toast.error("Institution name is required");
        setIsSubmitting(false);
        return;
      }

      if (!form.institutionPhone.trim()) {
        toast.error("Institution phone is required");
        setIsSubmitting(false);
        return;
      }

      if (!form.primaryContactPerson.trim()) {
        toast.error("Primary contact person is required");
        setIsSubmitting(false);
        return;
      }

      if (!form.primaryContactPhone.trim()) {
        toast.error("Primary contact phone is required");
        setIsSubmitting(false);
        return;
      }

      if (!form.branchId) {
        toast.error("Branch is required");
        setIsSubmitting(false);
        return;
      }

      if (mode === "create" && !form.password.trim()) {
        toast.error("Password is required");
        setIsSubmitting(false);
        return;
      }

      const validAdministrators = administrators.filter(
        (admin) => admin.name.trim() && admin.post.trim()
      );

      if (validAdministrators.length < 2) {
        toast.error(
          "At least 2 administrators with name and position are required"
        );
        setIsSubmitting(false);
        return;
      }

      if (mode === "create") {
        const createData = {
          institutionName: form.institutionName.trim(),
          institutionType: form.institutionType,
          institutionPhone: form.institutionPhone.trim(),
          institutionEmail: form.institutionEmail.trim().toLowerCase() || undefined,
          primaryContactPerson: form.primaryContactPerson.trim(),
          primaryContactPhone: form.primaryContactPhone.trim(),
          branchId:
            role === "ADMIN" ? form.branchId : branchId || form.branchId,
          password: form.password,
          primaryContactEmail: form.primaryContactEmail?.trim() || undefined,
          primaryContactTitle: form.primaryContactTitle?.trim() || undefined,
          foundedDate: form.foundedDate || undefined,
          founders: form.founders || undefined,
          majorObjective: form.majorObjective || undefined,
          majorActivities: form.majorActivities || undefined,
          legalStatus: form.legalStatus || undefined,
          registrationNumber: form.registrationNumber?.trim() || undefined,
          tinNumber: form.tinNumber?.trim() || undefined,
          yearEstablished: form.yearEstablished || undefined,
          businessSector: form.businessSector || undefined,
          numberOfEmployees: form.numberOfEmployees || undefined,
          plotNumber: form.plotNumber || undefined,
          street: form.street || undefined,
          village: form.village || undefined,
          parish: form.parish || undefined,
          subCounty: form.subCounty || undefined,
          constituency: form.constituency || undefined,
          town: form.town || undefined,
          district: form.district || undefined,
          postalAddress: form.postalAddress || undefined,
          accountTitle: form.accountTitle || undefined,
          accountType: form.accountType || undefined,
          operatingInstructions: form.operatingInstructions || undefined,
          signatoryChangeRules: form.signatoryChangeRules || undefined,
          bankName: form.bankName || undefined,
          bankAccountNumber: form.bankAccountNumber || undefined,
          entryFee: form.entryFee || undefined,
          initialDeposit: form.initialDeposit || undefined,
          administrators: validAdministrators,
        };

        const apiResponse = await fetch("/api/v1/institutions", {
             method: "POST",
             headers: { "Content-Type": "application/json" },
             body: JSON.stringify(createData)
        });

        const result = await apiResponse.json();

        if (!apiResponse.ok || result.error) {
           toast.error(result.error || "Failed to create institution");
        } else {
          toast.success("Institution created successfully");
          router.refresh();
          onClose();
        }
      } else if (mode === "edit" && initial?.id) {
        const updateData = {
          institutionName: form.institutionName.trim(),
          institutionType: form.institutionType,
          registrationDate:
            initial.registrationDate || new Date().toISOString(),
          institutionPhone: form.institutionPhone.trim(),
          institutionEmail: form.institutionEmail.trim().toLowerCase() || undefined,
          primaryContactPerson: form.primaryContactPerson.trim(),
          primaryContactPhone: form.primaryContactPhone.trim(),
          branchId:
            role === "ADMIN" ? form.branchId : branchId || form.branchId,
          primaryContactEmail: form.primaryContactEmail || undefined,
          primaryContactTitle: form.primaryContactTitle || undefined,
          foundedDate: form.foundedDate || undefined,
          founders: form.founders || undefined,
          majorObjective: form.majorObjective || undefined,
          majorActivities: form.majorActivities || undefined,
          legalStatus: form.legalStatus || undefined,
          registrationNumber: form.registrationNumber || undefined,
          tinNumber: form.tinNumber || undefined,
          yearEstablished: form.yearEstablished
            ? parseInt(form.yearEstablished)
            : undefined,
          businessSector: form.businessSector || undefined,
          numberOfEmployees: form.numberOfEmployees
            ? parseInt(form.numberOfEmployees)
            : undefined,
          plotNumber: form.plotNumber || undefined,
          street: form.street || undefined,
          village: form.village || undefined,
          parish: form.parish || undefined,
          subCounty: form.subCounty || undefined,
          constituency: form.constituency || undefined,
          town: form.town || undefined,
          district: form.district || undefined,
          postalAddress: form.postalAddress || undefined,
          accountTitle: form.accountTitle || undefined,
          accountType: form.accountType || undefined,
          operatingInstructions: form.operatingInstructions || undefined,
          signatoryChangeRules: form.signatoryChangeRules || undefined,
          bankName: form.bankName || undefined,
          bankAccountNumber: form.bankAccountNumber || undefined,
          entryFee: form.entryFee ? parseFloat(form.entryFee) : undefined,
          initialDeposit: form.initialDeposit
            ? parseFloat(form.initialDeposit)
            : undefined,
          administrators: validAdministrators,
        };

        const updateRes = await fetch(`/api/v1/institutions/${initial.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updateData),
        });
        const result = await updateRes.json();

        if (!updateRes.ok || result.error) {
          toast.error(result.error || "Failed to update institution");
        } else {
          toast.success("Institution updated successfully");
          router.refresh();
          onClose();
        }
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      toast.error("An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentBranchName =
    branches.find((b) => b.id === branchId)?.name || "No branch assigned";

  const tabs = [
    { id: "basic" as const, label: "Basic Info", icon: Building2 },
    { id: "background" as const, label: "Background", icon: Building2 },
    { id: "contact" as const, label: "Contact", icon: Users },
    { id: "location" as const, label: "Location", icon: MapPin },
    { id: "account" as const, label: "Account", icon: CreditCard },
    { id: "administrators" as const, label: "Administrators", icon: Users },
    { id: "financial" as const, label: "Financial", icon: CreditCard },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Create New Institution" : "Edit Institution"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Fill in the details to register a new institution"
              : "Update the institution details below"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 overflow-x-auto pb-2 border-b">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg whitespace-nowrap transition-all font-medium ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-md scale-105 ring-2 ring-primary/20"
                    : "bg-muted hover:bg-muted/80 text-muted-foreground hover:scale-102"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="text-sm">{tab.label}</span>
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="space-y-6 p-1">
            {activeTab === "basic" && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Basic Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="institutionName">
                      Institution Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="institutionName"
                      name="institutionName"
                      value={form.institutionName}
                      onChange={handleChange}
                      required
                      placeholder="Enter institution name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="institutionType">
                      Institution Type <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={form.institutionType}
                      onValueChange={(value) =>
                        handleSelectChange("institutionType", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {organizationTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {role === "ADMIN" ? (
                    <div className="space-y-2">
                      <Label htmlFor="branchId">
                        Branch <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        value={form.branchId}
                        onValueChange={(value) =>
                          handleSelectChange("branchId", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select branch" />
                        </SelectTrigger>
                        <SelectContent>
                          {branches.map((branch) => (
                            <SelectItem key={branch.id} value={branch.id}>
                              {branch.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="branchId">Branch</Label>
                      <Input
                        id="branchId"
                        value={currentBranchName}
                        disabled
                        className="bg-muted"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="institutionEmail">
                      Institution Email <span className="text-muted-foreground text-sm">(optional)</span>
                    </Label>
                    <Input
                      id="institutionEmail"
                      name="institutionEmail"
                      type="email"
                      value={form.institutionEmail}
                      onChange={handleChange}
                      placeholder="institution@example.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="institutionPhone">
                      Institution Phone <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      type="tel"
                      id="institutionPhone"
                      name="institutionPhone"
                      value={form.institutionPhone}
                      onChange={handleChange}
                      required
                      placeholder="+256 700 000000"
                    />
                  </div>

                  {mode === "create" && (
                    <div className="space-y-2">
                      <Label htmlFor="password">
                        Password <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="password"
                        name="password"
                        type="password"
                        value={form.password}
                        onChange={handleChange}
                        required
                        placeholder="Enter secure password"
                        minLength={6}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "background" && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Organization Background
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="foundedDate">When was it founded?</Label>
                    <Input
                      id="foundedDate"
                      name="foundedDate"
                      type="date"
                      value={form.foundedDate}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="founders">Founder(s)</Label>
                    <Input
                      id="founders"
                      name="founders"
                      value={form.founders}
                      onChange={handleChange}
                      placeholder="Names of founders"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="legalStatus">Legal Status</Label>
                    <Select
                      value={form.legalStatus}
                      onValueChange={(value) =>
                        handleSelectChange("legalStatus", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select legal status" />
                      </SelectTrigger>
                      <SelectContent>
                        {legalStatuses.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="registrationNumber">
                      Registration Number
                    </Label>
                    <Input
                      id="registrationNumber"
                      name="registrationNumber"
                      value={form.registrationNumber}
                      onChange={handleChange}
                      placeholder="Registration number"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tinNumber">TIN Number</Label>
                    <Input
                      id="tinNumber"
                      name="tinNumber"
                      value={form.tinNumber}
                      onChange={handleChange}
                      placeholder="Tax Identification Number"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="yearEstablished">Year Established</Label>
                    <Input
                      id="yearEstablished"
                      name="yearEstablished"
                      value={form.yearEstablished}
                      onChange={handleChange}
                      placeholder="e.g., 2020"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="businessSector">Business Sector</Label>
                    <Input
                      id="businessSector"
                      name="businessSector"
                      value={form.businessSector}
                      onChange={handleChange}
                      placeholder="e.g., Education, Healthcare"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="numberOfEmployees">
                      Number of Employees
                    </Label>
                    <Input
                      id="numberOfEmployees"
                      name="numberOfEmployees"
                      type="number"
                      value={form.numberOfEmployees}
                      onChange={handleChange}
                      placeholder="Total employees"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="majorObjective">Major Objective</Label>
                    <Textarea
                      id="majorObjective"
                      name="majorObjective"
                      value={form.majorObjective}
                      onChange={handleChange}
                      placeholder="What is the main objective?"
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="majorActivities">Major Activities</Label>
                    <Textarea
                      id="majorActivities"
                      name="majorActivities"
                      value={form.majorActivities}
                      onChange={handleChange}
                      placeholder="Main activities of the organization"
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "contact" && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Primary Contact Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="primaryContactPerson">
                      Contact Person <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="primaryContactPerson"
                      name="primaryContactPerson"
                      value={form.primaryContactPerson}
                      onChange={handleChange}
                      required
                      placeholder="Full name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="primaryContactTitle">Title/Position</Label>
                    <Input
                      id="primaryContactTitle"
                      name="primaryContactTitle"
                      value={form.primaryContactTitle}
                      onChange={handleChange}
                      placeholder="e.g., Director, Manager"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="primaryContactPhone">
                      Contact Phone <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="primaryContactPhone"
                      name="primaryContactPhone"
                      value={form.primaryContactPhone}
                      onChange={handleChange}
                      required
                      placeholder="+256 700 000000"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="primaryContactEmail">Contact Email</Label>
                    <Input
                      id="primaryContactEmail"
                      name="primaryContactEmail"
                      type="email"
                      value={form.primaryContactEmail}
                      onChange={handleChange}
                      placeholder="contact@example.com"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "location" && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Physical Location
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="district">District</Label>
                    <div className="flex gap-2">
                      <div className="w-full">
                        <SearchableSelect
                          isSearchable
                          primaryColor="blue"
                          value={selectedDistrictOption}
                          loading={locationLoading}
                          onChange={(item) => {
                            const next = !Array.isArray(item) ? item?.value?.toString() || "" : "";
                            setForm((prev) => ({
                              ...prev,
                              district: next,
                            }));
                          }}
                          options={districtOptions}
                          placeholder="select district"
                          classNames={{
                            menuButton: () =>
                              "flex w-full items-center justify-between rounded-md border-0 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6 text-sm",
                            menu: "z-50",
                          }}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          setLocationDialogType("district");
                          setLocationDraft("");
                          setLocationDialogOpen(true);
                        }}
                        aria-label="Create new district"
                        disabled={locationLoading}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="constituency">Constituency</Label>
                    <div className="flex gap-2">
                      <div className="w-full">
                        <SearchableSelect
                          isSearchable
                          primaryColor="blue"
                          value={selectedConstituencyOption}
                          loading={locationLoading}
                          onChange={(item) => {
                            const next = !Array.isArray(item) ? item?.value?.toString() || "" : "";
                            setForm((prev) => ({
                              ...prev,
                              constituency: next,
                              subCounty: "",
                              parish: "",
                              village: "",
                            }));
                          }}
                          options={constituencyOptions}
                          placeholder="select constituency"
                          classNames={{
                            menuButton: () =>
                              "flex w-full items-center justify-between rounded-md border-0 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6 text-sm",
                            menu: "z-50",
                          }}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          setLocationDialogType("constituency");
                          setLocationDraft("");
                          setLocationDialogOpen(true);
                        }}
                        aria-label="Create new constituency"
                        disabled={locationLoading}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subCounty">Sub County / Town Council</Label>
                    <div className="flex gap-2">
                      <div className="w-full">
                        <SearchableSelect
                          isSearchable
                          primaryColor="blue"
                          value={selectedSubCountyOption}
                          loading={locationLoading}
                          onChange={(item) => {
                            const next = !Array.isArray(item) ? item?.value?.toString() || "" : "";
                            setForm((prev) => ({
                              ...prev,
                              subCounty: next,
                              parish: "",
                              village: "",
                            }));
                          }}
                          options={subCountyOptions}
                          placeholder="select subcounty/town council"
                          isDisabled={!form.constituency}
                          classNames={{
                            menuButton: () =>
                              "flex w-full items-center justify-between rounded-md border-0 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6 text-sm",
                            menu: "z-50",
                          }}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          if (!form.constituency) {
                            toast.error("Select or create a constituency first.");
                            return;
                          }
                          setLocationDialogType("subCounty");
                          setLocationDraft("");
                          setLocationDialogOpen(true);
                        }}
                        aria-label="Create new sub county / town council"
                        disabled={!form.constituency || locationLoading}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="parish">Parish / Ward</Label>
                    <div className="flex gap-2">
                      <div className="w-full">
                        <SearchableSelect
                          isSearchable
                          primaryColor="blue"
                          value={selectedParishOption}
                          loading={locationLoading}
                          onChange={(item) => {
                            const next = !Array.isArray(item) ? item?.value?.toString() || "" : "";
                            setForm((prev) => ({
                              ...prev,
                              parish: next,
                              village: "",
                            }));
                          }}
                          options={parishOptions}
                          placeholder={form.subCounty ? "select parish/ward" : "Select sub county first"}
                          isDisabled={!form.subCounty}
                          classNames={{
                            menuButton: () =>
                              "flex w-full items-center justify-between rounded-md border-0 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6 text-sm",
                            menu: "z-50",
                          }}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          if (!form.constituency) {
                            toast.error("Select or create a constituency first.");
                            return;
                          }
                          if (!form.subCounty) {
                            toast.error("Select or create a sub county first.");
                            return;
                          }
                          setLocationDialogType("parish");
                          setLocationDraft("");
                          setLocationDialogOpen(true);
                        }}
                        aria-label="Create new parish / ward"
                        disabled={!form.subCounty || locationLoading}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="village">Village</Label>
                    <div className="flex gap-2">
                      <div className="w-full">
                        <SearchableSelect
                          isSearchable
                          primaryColor="blue"
                          value={selectedVillageOption}
                          loading={locationLoading}
                          onChange={(item) => {
                            const next = !Array.isArray(item) ? item?.value?.toString() || "" : "";
                            setForm((prev) => ({
                              ...prev,
                              village: next,
                            }));
                          }}
                          options={villageOptions}
                          placeholder={form.parish ? "select village" : "Select parish first"}
                          isDisabled={!form.parish}
                          classNames={{
                            menuButton: () =>
                              "flex w-full items-center justify-between rounded-md border-0 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6 text-sm",
                            menu: "z-50",
                          }}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          if (!form.constituency) {
                            toast.error("Select or create a constituency first.");
                            return;
                          }
                          if (!form.subCounty) {
                            toast.error("Select or create a sub county first.");
                            return;
                          }
                          if (!form.parish) {
                            toast.error("Select or create a parish first.");
                            return;
                          }
                          setLocationDialogType("village");
                          setLocationDraft("");
                          setLocationDialogOpen(true);
                        }}
                        aria-label="Create new village"
                        disabled={!form.parish || locationLoading}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="town">Town/City</Label>
                    <Input
                      id="town"
                      name="town"
                      value={form.town}
                      onChange={handleChange}
                      placeholder="Town or City"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="postalAddress">Postal Address</Label>
                    <Input
                      id="postalAddress"
                      name="postalAddress"
                      value={form.postalAddress}
                      onChange={handleChange}
                      placeholder="P.O. Box ..."
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "account" && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Account Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="accountTitle">Account Title</Label>
                    <Input
                      id="accountTitle"
                      name="accountTitle"
                      value={form.accountTitle}
                      onChange={handleChange}
                      placeholder="Account name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="accountType">Account Type</Label>
                    <Select
                      value={form.accountType}
                      onValueChange={(value) =>
                        handleSelectChange("accountType", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select account type" />
                      </SelectTrigger>
                      <SelectContent>
                        {accountTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bankName">Bank Name</Label>
                    <Input
                      id="bankName"
                      name="bankName"
                      value={form.bankName}
                      onChange={handleChange}
                      placeholder="Bank name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bankAccountNumber">
                      Bank Account Number
                    </Label>
                    <Input
                      id="bankAccountNumber"
                      name="bankAccountNumber"
                      value={form.bankAccountNumber}
                      onChange={handleChange}
                      placeholder="Account number"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="operatingInstructions">
                      Operating Instructions
                    </Label>
                    <Textarea
                      id="operatingInstructions"
                      name="operatingInstructions"
                      value={form.operatingInstructions}
                      onChange={handleChange}
                      placeholder="Account operating instructions"
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="signatoryChangeRules">
                      Signatory Change Rules
                    </Label>
                    <Textarea
                      id="signatoryChangeRules"
                      name="signatoryChangeRules"
                      value={form.signatoryChangeRules}
                      onChange={handleChange}
                      placeholder="Rules for changing signatories"
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "administrators" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Administrators (Min. 2 required)
                  </h3>
                  <Button
                    type="button"
                    onClick={addAdministrator}
                    variant="outline"
                    size="sm"
                    disabled={isUploading}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Administrator
                  </Button>
                </div>

                <div className="space-y-6">
                  {administrators.map((admin, index) => (
                    <div
                      key={index}
                      className="p-4 border rounded-lg space-y-4 relative"
                    >
                      {administrators.length > 2 && (
                        <Button
                          type="button"
                          onClick={() => removeAdministrator(index)}
                          variant="ghost"
                          size="sm"
                          className="absolute top-2 right-2 text-destructive hover:text-destructive"
                          disabled={isUploading}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}

                      <h4 className="font-medium text-sm text-muted-foreground">
                        Administrator {index + 1}
                      </h4>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>
                            Full Name <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            value={admin.name}
                            onChange={(e) =>
                              handleAdministratorChange(
                                index,
                                "name",
                                e.target.value
                              )
                            }
                            placeholder="Administrator full name"
                            required
                            disabled={isUploading}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>
                            Position/Post{" "}
                            <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            value={admin.post}
                            onChange={(e) =>
                              handleAdministratorChange(
                                index,
                                "post",
                                e.target.value
                              )
                            }
                            placeholder="e.g., Chairperson, Secretary"
                            required
                            disabled={isUploading}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Phone Number</Label>
                          <Input
                            value={admin.phone}
                            onChange={(e) =>
                              handleAdministratorChange(
                                index,
                                "phone",
                                e.target.value
                              )
                            }
                            placeholder="+256 700 000000"
                            disabled={isUploading}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Email</Label>
                          <Input
                            type="email"
                            value={admin.email}
                            onChange={(e) =>
                              handleAdministratorChange(
                                index,
                                "email",
                                e.target.value
                              )
                            }
                            placeholder="email@example.com"
                            disabled={isUploading}
                          />
                        </div>

                        {/* Photo Upload */}
                        <div className="space-y-2">
                          <Label>Photo</Label>
                          <div className="flex gap-2">
                            <div
                              className={`flex-1 border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                                isDragging
                                  ? "border-primary bg-primary/5"
                                  : "border-muted-foreground/25 hover:border-primary/50"
                              } ${isUploading ? "opacity-50 cursor-not-allowed" : ""}`}
                              onDrop={(e) => handleDrop(e, index, "photo")}
                              onDragOver={handleDragOver}
                              onDragLeave={handleDragLeave}
                              onClick={() => {
                                if (!isUploading) {
                                  photoInputRefs.current[index]?.click();
                                }
                              }}
                            >
                              {admin.photo ? (
                                <div className="space-y-2">
                                  <img
                                    src={admin.photo}
                                    alt="Admin photo"
                                    className="w-16 h-16 rounded-full mx-auto object-cover"
                                  />
                                  <p className="text-xs text-muted-foreground">
                                    Click to change
                                  </p>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                                  <p className="text-sm text-muted-foreground">
                                    {isUploading
                                      ? "Uploading..."
                                      : "Drop photo or click"}
                                  </p>
                                </div>
                              )}
                              <input
                                ref={(el) => {
                                  photoInputRefs.current[index] = el;
                                }}
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    handleFileSelect(index, "photo", file);
                                  }
                                }}
                                className="hidden"
                                disabled={isUploading}
                              />
                            </div>
                            <Button
                              type="button"
                              onClick={() => openCamera(index, "photo")}
                              variant="outline"
                              size="sm"
                              disabled={isUploading}
                            >
                              <Camera className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Signature Upload */}
                        <div className="space-y-2">
                          <Label>Signature</Label>
                          <div className="flex gap-2">
                            <div
                              className={`flex-1 border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                                isDragging
                                  ? "border-primary bg-primary/5"
                                  : "border-muted-foreground/25 hover:border-primary/50"
                              } ${isUploading ? "opacity-50 cursor-not-allowed" : ""}`}
                              onDrop={(e) => handleDrop(e, index, "signature")}
                              onDragOver={handleDragOver}
                              onDragLeave={handleDragLeave}
                              onClick={() => {
                                if (!isUploading) {
                                  signatureInputRefs.current[index]?.click();
                                }
                              }}
                            >
                              {admin.signature ? (
                                <div className="space-y-2">
                                  <img
                                    src={admin.signature}
                                    alt="Admin signature"
                                    className="w-24 h-12 mx-auto object-contain"
                                  />
                                  <p className="text-xs text-muted-foreground">
                                    Click to change
                                  </p>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                                  <p className="text-sm text-muted-foreground">
                                    {isUploading
                                      ? "Uploading..."
                                      : "Drop signature or click"}
                                  </p>
                                </div>
                              )}
                              <input
                                ref={(el) => {
                                  signatureInputRefs.current[index] = el;
                                }}
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    handleFileSelect(index, "signature", file);
                                  }
                                }}
                                className="hidden"
                                disabled={isUploading}
                              />
                            </div>
                            <Button
                              type="button"
                              onClick={() => openCamera(index, "signature")}
                              variant="outline"
                              size="sm"
                              disabled={isUploading}
                            >
                              <Camera className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "financial" && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Financial Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="entryFee">
                      Entry Fee (UGX) - Default: 30,000
                    </Label>
                    <Input
                      id="entryFee"
                      name="entryFee"
                      type="number"
                      value={form.entryFee}
                      onChange={handleChange}
                      placeholder="30000"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="initialDeposit">
                      Initial Deposit (UGX) - Default: 20,000
                    </Label>
                    <Input
                      id="initialDeposit"
                      name="initialDeposit"
                      type="number"
                      value={form.initialDeposit}
                      onChange={handleChange}
                      placeholder="20000"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      name="description"
                      value={form.description}
                      onChange={handleChange}
                      placeholder="Additional information about the institution"
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="notes">Internal Notes</Label>
                    <Textarea
                      id="notes"
                      name="notes"
                      value={form.notes}
                      onChange={handleChange}
                      placeholder="Internal notes (not visible to institution)"
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </form>

        <DialogFooter className="border-t pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting || isUploading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={isSubmitting || isUploading}
          >
            {isSubmitting
              ? "Saving..."
              : isUploading
                ? "Uploading..."
                : mode === "create"
                  ? "Create Institution"
                  : "Update Institution"}
          </Button>
        </DialogFooter>

        {/* Camera Modal */}
        {isCameraOpen && (
          <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
            <div className="bg-background rounded-lg max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  Capture{" "}
                  {currentCameraIndex?.field === "photo"
                    ? "Photo"
                    : "Signature"}
                </h3>
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

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {availableCameras.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="institution-camera-device">Camera source</Label>
                    <select
                      id="institution-camera-device"
                      value={selectedCameraId}
                      onChange={(e) => {
                        void handleCameraChange(e.target.value);
                      }}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring"
                      disabled={isUploading || !isCameraOpen}
                    >
                      <option value="">Automatic selection</option>
                      {availableCameras.map((camera, index) => (
                        <option key={camera.deviceId || index} value={camera.deviceId}>
                          {camera.label || `Camera ${index + 1}`}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground">
                      Pick the external camera here if it is not selected automatically.
                    </p>
                  </div>
                )}

                <div className="relative bg-black rounded-lg overflow-hidden aspect-video max-h-[42vh]">
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

                <div className="text-center text-sm text-muted-foreground">
                  {capturedPreview
                    ? "Review the image before uploading."
                    : isCameraReady
                      ? "Camera is ready. Position the subject and capture the frame."
                      : "Starting camera... please wait."}
                </div>
              </div>

              <div className="border-t px-6 py-4 bg-background">
                <div className="flex flex-wrap gap-2 justify-center">
                  {!capturedPreview ? (
                    <Button type="button" onClick={capturePhoto} disabled={!isCameraReady}>
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
          </div>
        )}
      </DialogContent>
      <Dialog open={locationDialogOpen} onOpenChange={(open) => {
        setLocationDialogOpen(open);
        if (!open) {
          setLocationDialogType(null);
          setLocationDraft("");
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {locationDialogType === "district"
                ? "Create New District"
                : locationDialogType === "constituency"
                ? "Create New Constituency"
                : locationDialogType === "subCounty"
                ? "Create New Sub County / Town Council"
                : locationDialogType === "parish"
                ? "Create New Parish / Ward"
                : "Create New Village"}
            </DialogTitle>
          <DialogDescription>
              {locationDialogType === "district"
                ? "Type the district name and save it immediately."
                : locationDialogType === "constituency"
                ? "Type the constituency name and save it immediately."
                : locationDialogType === "subCounty"
                ? "Type the new sub county or town council name and save it immediately."
                : locationDialogType === "parish"
                ? "Type the new parish or ward name and save it under the selected sub county."
                : "Type the new village name and save it under the selected parish."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {locationDialogType === "district" && (
              <div className="rounded-md border bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Districts are shared across members and institutions.
              </div>
            )}
            {locationDialogType === "constituency" && (
              <div className="rounded-md border bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Constituency will be added to the shared location catalog.
              </div>
            )}
            {locationDialogType === "village" && (
              <div className="rounded-md border bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Parish: {form.parish || "Select or create a parish first"}
              </div>
            )}
            {locationDialogType === "parish" && (
              <div className="rounded-md border bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Sub county: {form.subCounty || "Select or create a sub county first"}
              </div>
            )}
              <div className="space-y-2">
                <Label htmlFor="locationDraft">
                  {locationDialogType === "district"
                    ? "District"
                    : locationDialogType === "constituency"
                    ? "Constituency"
                    : locationDialogType === "subCounty"
                      ? "Sub County / Town Council"
                      : locationDialogType === "parish"
                      ? "Parish / Ward"
                  : "Village"}
              </Label>
                <Input
                  id="locationDraft"
                  value={locationDraft}
                  onChange={(event) => setLocationDraft(event.target.value)}
                  placeholder={
                    locationDialogType === "district"
                      ? "Type the district name"
                      : locationDialogType === "constituency"
                      ? "Type the constituency name"
                      : locationDialogType === "subCounty"
                        ? "Type the new sub county or town council"
                      : locationDialogType === "parish"
                    ? "Type the new parish or ward"
                    : "Type the new village"
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={locationLoading}
              onClick={() => {
                setLocationDialogOpen(false);
                setLocationDialogType(null);
                setLocationDraft("");
              }}
            >
              Cancel
            </Button>
            <Button type="button" onClick={confirmLocationCreation} disabled={locationLoading}>
              {locationLoading ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
