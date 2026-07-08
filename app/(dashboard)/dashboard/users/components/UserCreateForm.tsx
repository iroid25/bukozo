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
  Plus,

  ShieldCheck, // Icon for Role
} from "lucide-react";
import { useSession } from "next-auth/react";
import { Gender, UserRole } from "@prisma/client";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import TextInput from "@/components/FormInputs/TextInput";
import { UserCreateDTO } from "@/types/user";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import FormSelectInput from "@/components/FormInputs/FormSelectInput";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import FingerprintScanner from "@/components/FingerprintScanner";
import type { FingerprintCapture } from "@/lib/fingerprint";
import {
  formatDateOfBirthForInput,
  isAtLeast18YearsOld,
} from "@/lib/date-of-birth";
import {
  BUKONZO_EAST_CONSTITUENCIES,
  getBukonzoEastConstituencyNames,
  getBukonzoEastParishes,
  getBukonzoEastVillages,
} from "@/lib/location/bukonzo-east";
import {
  getMemberNinPrefix,
  isMemberNinPrefixValid,
  normalizeMemberNin,
} from "@/lib/member-nin";
import { useUploadThing } from "@/lib/uploadthing";
import Select from "react-tailwindcss-select";
import type {
  Option as SelectOption,
  Options as SelectOptions,
} from "react-tailwindcss-select/dist/components/type";

type Option = {
  label: string;
  value: string;
};

type Branch = {
  id: string;
  name: string;
  location: string;
  contactPerson?: string | null;
  contactPhone?: string | null;
  email?: string | null;
  _count?: {
    users: number;
    accounts: number;
    loans: number;
  };
};

type CameraDevice = {
  deviceId: string;
  label: string;
};

export default function UserCreateForm({
  initialData,
  editingId,
  isOpen,
  onClose,
  branchId,
  role,
}: {
  initialData?: Partial<UserCreateDTO>;
  editingId?: string;
  isOpen: boolean;
  onClose: () => void;
  branchId?: string;
  role?: string;
  branches?: Branch[];
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
    watch,
    setValue,
  } = useForm<UserCreateDTO>({
    mode: "onChange",
    defaultValues: {
      firstName: initialData?.firstName || "",
      lastName: initialData?.lastName || "",
      phone: initialData?.phone || "",
      email: initialData?.email || "",
      dateOfBirth: formatDateOfBirthForInput(initialData?.dateOfBirth || null),
      registrationDate: initialData?.registrationDate
        ? new Date(initialData.registrationDate).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      gender: (initialData?.gender as Gender) || undefined,
      nationalId: initialData?.nationalId || "",
      idCard: initialData?.idCard || initialData?.nationalId || "",
      password: editingId ? "" : `Password@${new Date().getFullYear()}`,
      jobTitle: initialData?.jobTitle || "",
      village: initialData?.village || "",
      parish: initialData?.parish || "",
      subCounty: initialData?.subCounty || "",
      constituency: initialData?.constituency || "",
      postalAddress: initialData?.postalAddress || initialData?.address || "",
      nokName: initialData?.nokName || "",
      nokRelationship: initialData?.nokRelationship || "",
      nokPhone: initialData?.nokPhone || "",
      image: initialData?.image || "",
      district: initialData?.district || "Kasese",
      role: (initialData?.role as UserRole) || (role as UserRole) || UserRole.MEMBER,
    },
  });

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>(initialData?.image || "");

  // Camera states
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [availableCameras, setAvailableCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState("");

  const [phone, setPhone] = useState("+256 ");

  // ✅ Branch fetching state
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [branchOptions, setBranchOptions] = useState<Option[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<Option>({
    label: "Loading...",
    value: "",
  });
  
  // Biometric State
  const [fingerprintTemplate, setFingerprintTemplate] = useState<string>(
    initialData?.fingerprintTemplate ||
      ((initialData as any)?.member?.fingerprintTemplate ?? ""),
  );
  const [fingerprintCapture, setFingerprintCapture] =
    useState<FingerprintCapture | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [isImageUploading, setIsImageUploading] = useState(false);
  
  const router = useRouter();
  const userRole = role?.toUpperCase();
  const watchedDateOfBirth = watch("dateOfBirth");
  const watchedGender = watch("gender");
  const watchedConstituency = watch("constituency") || "";
  const watchedSubCounty = watch("subCounty") || "";
  const watchedParish = watch("parish") || "";
  const watchedVillage = watch("village") || "";
  const expectedMemberNinPrefix = getMemberNinPrefix(
    watchedDateOfBirth,
    watchedGender,
  );
  const parishSuggestions = getBukonzoEastParishes(watchedConstituency, watchedSubCounty);
  const [locationCatalog, setLocationCatalog] = useState<
    Array<{
      id: string;
      name: string;
      subCounties: Array<{
        id: string;
        name: string;
        constituencyId: string;
        parishes: Array<{
          id: string;
          name: string;
          subCountyId: string;
          villages: Array<{ id: string; name: string; parishId: string }>;
        }>;
      }>;
    }>
  >([]);
  const [districtCatalog, setDistrictCatalog] = useState<string[]>(["Kasese"]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [locationDialogType, setLocationDialogType] = useState<"district" | "constituency" | "subCounty" | "parish" | "village" | null>(null);
  const [locationDraft, setLocationDraft] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const watchedRole = watch("role");
  const isMemberRole = watchedRole === UserRole.MEMBER;
  const districtOptions = districtCatalog;
  const watchedDistrict = watch("district") || "Kasese";
  const searchableDistrictOptions: SelectOptions = districtOptions.map((name) => ({
    label: name,
    value: name,
  }));
  const selectedDistrictOption: SelectOption | null = watchedDistrict
    ? { label: watchedDistrict, value: watchedDistrict }
    : null;
  const constituencyOptions = locationCatalog.length
    ? locationCatalog.map((entry) => entry.name)
    : getBukonzoEastConstituencyNames();
  const currentConstituencyRecord =
    locationCatalog.find((entry) => entry.name === watchedConstituency) || null;
  const subCountyOptions = currentConstituencyRecord?.subCounties.map((entry) => entry.name) || [];
  const currentSubCountyRecord =
    currentConstituencyRecord?.subCounties.find((entry) => entry.name === watchedSubCounty) || null;
  const currentParishSuggestions = currentSubCountyRecord?.parishes.map((parish) => parish.name) || parishSuggestions;
  const currentParishRecord =
    currentSubCountyRecord?.parishes.find((parish) => parish.name === watchedParish) || null;
  const currentVillageSuggestions =
    currentParishRecord?.villages?.length
      ? currentParishRecord.villages.map((village) => village.name)
      : getBukonzoEastVillages(watchedConstituency, watchedSubCounty, watchedParish);
  const searchableConstituencyOptions: SelectOptions = constituencyOptions.map((name) => ({
    label: name,
    value: name,
  }));
  const searchableSubCountyOptions: SelectOptions = subCountyOptions.map((name) => ({
    label: name,
    value: name,
  }));
  const searchableParishOptions: SelectOptions = currentParishSuggestions.map((name) => ({
    label: name,
    value: name,
  }));
  const searchableVillageOptions: SelectOptions = currentVillageSuggestions.map((name) => ({
    label: name,
    value: name,
  }));
  const selectedConstituencyOption: SelectOption | null = watchedConstituency
    ? { label: watchedConstituency, value: watchedConstituency }
    : null;
  const selectedSubCountyOption: SelectOption | null = watchedSubCounty
    ? { label: watchedSubCounty, value: watchedSubCounty }
    : null;
  const selectedParishOption: SelectOption | null = watchedParish
    ? { label: watchedParish, value: watchedParish }
    : null;
  const selectedVillageOption: SelectOption | null = watchedVillage
    ? { label: watchedVillage, value: watchedVillage }
    : null;

  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "ADMIN";

  const debugUpload = async (event: string, details: Record<string, unknown>) => {
    try {
      await fetch("/api/debug/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          event,
          details,
          at: new Date().toISOString(),
        }),
      });
    } catch (error) {
      console.error("[camera-debug] failed to send debug event", event, error);
    }
  };

  const { startUpload } = useUploadThing("userProfileImage", {
    onClientUploadComplete: (res) => {
      console.log("✅ Client upload complete:", res);
      void debugUpload("client_upload_complete", {
        responseLength: res?.length ?? 0,
        hasFirstUrl: !!res?.[0]?.url,
      });

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
      void debugUpload("upload_error", {
        message: error.message,
        name: error.name,
        stack: error.stack,
      });
      toast.error(`Upload failed: ${error.message}`);
    },
    onUploadBegin: (fileName) => {
      console.log("📤 Upload begin:", fileName);
      void debugUpload("upload_begin", { fileName });
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

  // ✅ Fetch branches from API
  const fetchBranches = async () => {
    try {
      setBranchesLoading(true);
      console.log("📡 Fetching branches from API...");

      const response = await fetch("/api/v1/branches");

      if (!response.ok) {
        throw new Error("Failed to fetch branches");
      }

      const result = await response.json();
      console.log("✅ Branches fetched:", result.data);

      setBranches(result.data || []);

      // Convert to options
      const options: Option[] = (result.data || []).map((branch: Branch) => ({
        label: branch.name,
        value: branch.id,
      }));

      setBranchOptions(options);

      // Set default selection
      if (options.length > 0) {
        // If editing and has initialData.branchId, select that branch
        if (editingId && initialData?.branchId) {
          const existingBranch = options.find(
            (opt) => opt.value === initialData.branchId
          );
          if (existingBranch) {
            setSelectedBranch(existingBranch);
          } else {
            setSelectedBranch(options[0]);
          }
        }
        // If branchId prop is provided, select that branch
        else if (branchId) {
          const matchingBranch = options.find((opt) => opt.value === branchId);
          if (matchingBranch) {
            setSelectedBranch(matchingBranch);
          } else {
            setSelectedBranch(options[0]);
          }
        }
        // Otherwise select first branch
        else {
          setSelectedBranch(options[0]);
        }
      } else {
        setSelectedBranch({ label: "No branches available", value: "" });
      }

      setBranchesLoading(false);
    } catch (error) {
      console.error("❌ Error fetching branches:", error);
      toast.error("Failed to load branches", {
        description: "Please refresh the page and try again",
      });
      setBranchesLoading(false);
      setBranchOptions([]);
      setSelectedBranch({ label: "No branches available", value: "" });
    }
  };

  // ✅ Use provided branches or fetch from API
  useEffect(() => {
    if (isOpen) {
      if (branches && branches.length > 0) {
        console.log("📦 Using provided branches in UserCreateForm");
        setBranches(branches);
        const options: Option[] = branches.map((branch: Branch) => ({
          label: branch.name,
          value: branch.id,
        }));
        setBranchOptions(options);
        
        // Set default selection
        if (options.length > 0) {
          if (editingId && initialData?.branchId) {
            const existingBranch = options.find((opt) => opt.value === initialData.branchId);
            if (existingBranch) setSelectedBranch(existingBranch);
            else setSelectedBranch(options[0]);
          } else if (branchId) {
            const matchingBranch = options.find((opt) => opt.value === branchId);
            if (matchingBranch) setSelectedBranch(matchingBranch);
            else setSelectedBranch(options[0]);
          } else {
            setSelectedBranch(options[0]);
          }
        }
      } else {
        fetchBranches();
      }
    }
  }, [isOpen, branches]);

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

  useEffect(() => {
    if (isOpen) {
      void fetchLocationCatalog();
    }
  }, [isOpen]);

  useEffect(() => {
    if (
      isOpen &&
      isMemberRole &&
      !watchedConstituency &&
      constituencyOptions.length === 1
    ) {
      setValue("constituency", constituencyOptions[0], {
        shouldDirty: false,
        shouldValidate: true,
      });
    }
  }, [constituencyOptions, isMemberRole, isOpen, setValue, watchedConstituency]);

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

  const startCamera = async (deviceId?: string) => {
    const currentStream = cameraStream;

    const tryGetStream = async (constraints: MediaStreamConstraints) => {
      return navigator.mediaDevices.getUserMedia(constraints);
    };

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        toast.error("Camera is not supported in this browser.");
        return;
      }

      const preferredConstraints = deviceId
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

      let stream: MediaStream;

      try {
        stream = await tryGetStream(preferredConstraints);
      } catch (preferredError) {
        if (deviceId) {
          throw preferredError;
        } else {
          throw preferredError;
        }
      }

      if (currentStream) {
        currentStream.getTracks().forEach((track) => track.stop());
      }

      setCameraStream(stream);
      setIsCameraOpen(true);
      setCapturedPreview(null);
      setCapturedFile(null);
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

  const openCamera = async () => {
    await startCamera(selectedCameraId || undefined);
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
    setCapturedFile(null);
    setIsCameraReady(false);
  };

  const handleCameraChange = async (deviceId: string) => {
    setSelectedCameraId(deviceId);
    setCapturedPreview(null);
    setCapturedFile(null);
    setIsCameraReady(false);
    await startCamera(deviceId || undefined);
  };

  const capturePhoto = () => {
    void debugUpload("capture_requested", {
      isCameraReady,
      hasVideo: !!videoRef.current,
    });

    console.log("[camera-debug] capture requested", {
      isCameraReady,
      hasVideo: !!videoRef.current,
    });

    if (!videoRef.current || !isCameraReady) {
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

    const maxWidth = 1280;
    const maxHeight = 1280;
    const sourceWidth = videoRef.current.videoWidth;
    const sourceHeight = videoRef.current.videoHeight;
    const scale = Math.min(1, maxWidth / sourceWidth, maxHeight / sourceHeight);
    const outputWidth = Math.max(1, Math.round(sourceWidth * scale));
    const outputHeight = Math.max(1, Math.round(sourceHeight * scale));

    canvas.width = outputWidth;
    canvas.height = outputHeight;
    ctx.drawImage(videoRef.current, 0, 0, outputWidth, outputHeight);
    const base64Image = canvas.toDataURL("image/jpeg", 0.78);

    void debugUpload("capture_canvas_ready", {
      sourceWidth,
      sourceHeight,
      outputWidth,
      outputHeight,
      previewLength: base64Image.length,
    });

    console.log("[camera-debug] capture canvas", {
      sourceWidth,
      sourceHeight,
      outputWidth,
      outputHeight,
      previewLength: base64Image.length,
    });

    canvas.toBlob((blob) => {
      if (!blob) {
        void debugUpload("capture_blob_failed", {});
        console.error("[camera-debug] canvas.toBlob returned null");
        toast.error("Could not prepare the captured image for upload.");
        return;
      }

      const file = new File([blob], `user_profile_${Date.now()}.jpg`, {
        type: "image/jpeg",
      });
      void debugUpload("capture_blob_ready", {
        name: file.name,
        size: file.size,
        type: file.type,
      });
      console.log("[camera-debug] captured file prepared", {
        name: file.name,
        size: file.size,
        type: file.type,
      });
      setCapturedFile(file);
    }, "image/jpeg", 0.78);

    setCapturedPreview(base64Image);
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      setIsImageUploading(true);
      void debugUpload("upload_image_called", {
        name: file.name,
        size: file.size,
        type: file.type,
      });

      console.log("[camera-debug] uploadImage called", {
        name: file.name,
        size: file.size,
        type: file.type,
      });

      if (file.size > 2 * 1024 * 1024) {
        void debugUpload("upload_rejected_size", { size: file.size });
        console.warn("[camera-debug] file rejected for size", file.size);
        toast.error("File size must be less than 2MB");
        return null;
      }

      const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
      if (!validTypes.includes(file.type)) {
        void debugUpload("upload_rejected_type", { type: file.type });
        console.warn("[camera-debug] file rejected for type", file.type);
        toast.error("Only JPG, JPEG, PNG, and WEBP files are allowed");
        return null;
      }

      console.log("[camera-debug] starting upload:", {
        name: file.name,
        size: file.size,
        type: file.type,
      });
      void debugUpload("upload_start", {
        name: file.name,
        size: file.size,
        type: file.type,
      });

      const res = await startUpload([file]);
      console.log("[camera-debug] upload response:", res);
      void debugUpload("upload_response", {
        responseLength: res?.length ?? 0,
        hasFirstUrl: !!res?.[0]?.url,
      });

      const uploadedFile = res?.[0] as
        | {
            url?: string;
            ufsUrl?: string;
            serverData?: { url?: string } | null;
          }
        | undefined;
      const directUrl = uploadedFile?.url || uploadedFile?.ufsUrl;
      console.log("[camera-debug] parsed upload result", {
        directUrl,
        hasServerData: !!uploadedFile?.serverData,
      });
      void debugUpload("upload_parsed", {
        hasDirectUrl: !!directUrl,
        hasServerData: !!uploadedFile?.serverData,
      });
      if (directUrl) {
        return directUrl;
      }

      void debugUpload("upload_no_url", {});
      return null;
    } catch (error) {
      console.error("[camera-debug] UploadThing error:", error);
      void debugUpload("upload_exception", {
        message: error instanceof Error ? error.message : String(error),
      });
      toast.error(
        error instanceof Error ? error.message : "Upload failed. Please try again.",
      );
      return null;
    } finally {
      setIsImageUploading(false);
    }
  };

  const uploadCapturedImage = async () => {
    try {
      void debugUpload("upload_clicked", {
        hasPreview: !!capturedPreview,
        hasFile: !!capturedFile,
      });
      console.log("[camera-debug] uploadCapturedImage clicked", {
        hasPreview: !!capturedPreview,
        hasFile: !!capturedFile,
      });

      let file = capturedFile;
      if (!file && !capturedPreview) {
        toast.error("Please capture the photo again.");
        return;
      }

      if (!file && capturedPreview) {
        const response = await fetch(capturedPreview);
        const blob = await response.blob();
        void debugUpload("preview_blob_ready", {
          blobSize: blob.size,
          blobType: blob.type,
        });
        console.log("[camera-debug] preview converted to blob", {
          blobSize: blob.size,
          blobType: blob.type,
        });
        const fileName = `user_profile_${Date.now()}.jpg`;
        file = new File([blob], fileName, { type: "image/jpeg" });
        void debugUpload("upload_file_from_preview", {
          name: file.name,
          size: file.size,
          type: file.type,
        });

        console.log("[camera-debug] upload file from preview", {
          name: file.name,
          size: file.size,
          type: file.type,
        });
      }

      if (!file) {
        toast.error("Please capture the photo again.");
        return;
      }

      const formData = new FormData();
      formData.append("file", file);

      void debugUpload("upload_server_request", {
        name: file.name,
        size: file.size,
        type: file.type,
      });

      console.log("[camera-debug] sending captured image to server route", {
        name: file.name,
        size: file.size,
        type: file.type,
      });

      const response = await fetch("/api/debug/upload-captured-image", {
        method: "POST",
        body: formData,
      });

      const responseText = await response.text();
      let result: any = null;
      try {
        result = JSON.parse(responseText);
      } catch {
        result = { ok: false, message: responseText };
      }

      console.log("[camera-debug] server upload result", {
        status: response.status,
        ok: response.ok,
        result,
      });
      void debugUpload("upload_server_result", {
        status: response.status,
        ok: response.ok,
        ...result,
      });

      const uploadedUrl = result?.url || result?.ufsUrl || result?.data?.ufsUrl || result?.data?.url;

      if (!response.ok || !uploadedUrl) {
        throw new Error(result?.message || "Upload failed. Please try again.");
      }

      setImageUrl(uploadedUrl);
      setValue("image", uploadedUrl);
      toast.success("Photo uploaded successfully!");
      closeCamera();
    } catch (error) {
      console.error("[camera-debug] uploadCapturedImage error:", error);
      toast.error("Upload failed. Please try again.");
    }
  };

  const handleFileSelect = async (file: File): Promise<string | null> => {
    if (!file) return null;

    void debugUpload("handle_file_select", {
      name: file.name,
      size: file.size,
      type: file.type,
    });
    console.log("[camera-debug] handleFileSelect received file", {
      name: file.name,
      size: file.size,
      type: file.type,
    });
    return uploadImage(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
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

  useEffect(() => {
    if (!isOpen) {
      closeCamera();
    }
  }, [isOpen]);

  useEffect(() => {
    if (editingId && initialData) {
      Object.keys(initialData).forEach((key) => {
        if (key === "dateOfBirth") {
          setValue(
            "dateOfBirth",
            formatDateOfBirthForInput(initialData.dateOfBirth || null),
          );
          return;
        }
        if (key === "registrationDate" && initialData.registrationDate) {
          setValue(
            "registrationDate",
            new Date(initialData.registrationDate)
              .toISOString()
              .split("T")[0],
          );
          return;
        }
        if (key === "nationalId") {
          setValue("nationalId", initialData.nationalId || "");
          setValue("idCard", initialData.idCard || initialData.nationalId || "");
          return;
        }
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

  useEffect(() => {
    if (!isMemberRole) {
      setFingerprintTemplate("");
      setFingerprintCapture(null);
    }
  }, [isMemberRole]);

  // ✅ Form submission - Posts to /api/v1/users
  async function saveUser(data: UserCreateDTO) {
    try {
      setLoading(true);

      // Validation
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

      if (!data.dateOfBirth) {
        toast.error("Date of Birth is required");
        setLoading(false);
        return;
      }

      if (isMemberRole && !data.registrationDate) {
        toast.error("Registration Date is required for members");
        setLoading(false);
        return;
      }

      if (!isAtLeast18YearsOld(data.dateOfBirth)) {
        toast.error("User must be at least 18 years old");
        setLoading(false);
        return;
      }

      // if (!data.email) {
      //   toast.error("Email Address is required");
      //   setLoading(false);
      //   return;
      // }

      if (!selectedBranch.value) {
        toast.error("Please select a branch");
        setLoading(false);
        return;
      }

      if (isMemberRole && !fingerprintTemplate) {
        toast.error("Please capture the member fingerprint before saving.");
        setLoading(false);
        return;
      }

      const name = `${data.firstName || ""} ${data.lastName}`.trim();
      const normalizedGender = (data.gender ||
        initialData?.gender ||
        null) as Gender | null;
      const normalizedNin = normalizeMemberNin(data.idCard || data.nationalId);

      if (isMemberRole && !normalizedGender) {
        toast.error("Gender is required for members");
        setLoading(false);
        return;
      }

      if (isMemberRole && !normalizedNin) {
        toast.error("NIN / ID Card is required for members");
        setLoading(false);
        return;
      }

      if (
        isMemberRole &&
        normalizedNin &&
        !isMemberNinPrefixValid(
          normalizedNin,
          watchedDateOfBirth,
          normalizedGender,
        )
      ) {
        toast.error(
          expectedMemberNinPrefix
            ? `NIN must start with ${expectedMemberNinPrefix} for the selected gender and date of birth`
            : "Select date of birth and gender before entering the NIN",
        );
        setLoading(false);
        return;
      }

      const nextEmail = (data.email || initialData?.email || "").trim();
      const nextJobTitle = (data.jobTitle || initialData?.jobTitle || "").trim();
      const nextNationalId = normalizedNin || normalizeMemberNin(initialData?.idCard || initialData?.nationalId) || null;
      const nextIdCard = nextNationalId;
      const nextPhone = (phone && phone.trim() !== "+256" && phone.trim() !== "+256 ") ? phone.trim() : null;

      if (!nextEmail && !nextPhone) {
        toast.error("Phone number or email is required");
        setLoading(false);
        return;
      }

      const payload = {
        firstName: data.firstName || "",
        lastName: data.lastName,
        email: nextEmail || null,
        name: name,
        phone: nextPhone,
        dateOfBirth: data.dateOfBirth || null,
        registrationDate: data.registrationDate || null,
        nationalId: nextNationalId,
        idCard: nextIdCard,
        gender: isMemberRole ? normalizedGender : null,
        jobTitle: nextJobTitle || null,
        branchId: selectedBranch.value,
        role: data.role || role?.toUpperCase() || "MEMBER",
        areaOfOperation: (data.areaOfOperation || initialData?.areaOfOperation || "").trim() || null,
        image: imageUrl || null,
        address: (data.address || initialData?.address || "").trim() || null,
        district: isMemberRole ? (data.district || "Kasese").trim() || null : null,
        constituency: isMemberRole ? (data.constituency || "").trim() || null : null,
        village: isMemberRole ? (data.village || "").trim() || null : null,
        parish: isMemberRole ? (data.parish || "").trim() || null : null,
        subCounty: isMemberRole ? (data.subCounty || "").trim() || null : null,
        postalAddress: isMemberRole ? (data.postalAddress || "").trim() || null : null,
        nokName: isMemberRole ? (data.nokName || "").trim() || null : null,
        nokRelationship: isMemberRole ? (data.nokRelationship || "").trim() || null : null,
        nokPhone: isMemberRole ? (data.nokPhone || "").trim() || null : null,
        fingerprintTemplate: fingerprintTemplate || null,
        fingerprintQuality: fingerprintCapture?.ImageQuality ?? null,
        ...(editingId
          ? {}
          : {
              password:
                data.password || `Password@${new Date().getFullYear()}`,
            }),
      };

      console.log("\n" + "=".repeat(50));
      console.log("🚀 USER FORM SUBMISSION");
      console.log("=".repeat(50));
      console.log("Mode:", editingId ? "EDIT" : "CREATE");
      console.log("\n📝 Payload:");
      console.log(JSON.stringify(payload, null, 2));
      console.log("=".repeat(50) + "\n");

      const endpoint = `/api/v1/users`;
      const method = editingId ? "PUT" : "POST";
      const bodyData = editingId ? { ...payload, userId: editingId } : payload;

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bodyData),
      });

      const result = await response.json();

      console.log("📥 Response:", response.status);
      console.log(JSON.stringify(result, null, 2));

      if (!response.ok) {
        const detailMessage = Array.isArray(result?.details)
          ? result.details
              .map((detail: { field?: string; message?: string }) =>
                detail.field ? `${detail.field}: ${detail.message}` : detail.message,
              )
              .filter(Boolean)
              .join(" | ")
          : "";
        toast.error(
          editingId ? "Failed to Update User" : "Failed to Create User",
          {
            description: detailMessage || result.error || "Something went wrong",
          }
        );
        setLoading(false);
        return;
      }

      setLoading(false);
      toast.success(
        editingId ? "User Updated Successfully!" : "User Created Successfully!",
        {
          description: editingId
            ? "Changes have been saved"
            : "Registration email sent",
        }
      );
      reset();
      setImageUrl("");
      setPhone("+256 ");
      setFingerprintTemplate("");
      setFingerprintCapture(null);
      onClose();
      router.refresh();
    } catch (error: any) {
      console.error("\n❌ ERROR:", error);
      toast.error("Something went wrong", {
        description: error.message || "Please try again",
      });
      setLoading(false);
    }
  }

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
          setValue("district", result.data.name, {
            shouldDirty: true,
            shouldValidate: true,
          });
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
          setValue("constituency", result.data.name, {
            shouldDirty: true,
            shouldValidate: true,
          });
          setValue("subCounty", "", {
            shouldDirty: true,
            shouldValidate: true,
          });
          setValue("parish", "", {
            shouldDirty: true,
            shouldValidate: true,
          });
          setValue("village", "", {
            shouldDirty: true,
            shouldValidate: true,
          });
        } else if (locationDialogType === "subCounty") {
          if (!watchedConstituency) {
            throw new Error("Select or create a constituency first, then create the sub county or town council.");
          }
          const response = await fetch("/api/v1/location-catalog", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              kind: "subCounty",
              name: value,
              constituencyName: watchedConstituency,
            }),
          });
          const result = await response.json();
          if (!response.ok || !result?.success) {
            throw new Error(result?.error || "Failed to create sub county");
          }

          setLocationCatalog((current) => {
            return current.map((entry) =>
              entry.name === watchedConstituency
                ? {
                    ...entry,
                    subCounties: [
                      ...entry.subCounties.filter((subCounty) => subCounty.name !== result.data.name),
                      result.data,
                    ].sort((a, b) => a.name.localeCompare(b.name)),
                  }
                : entry,
            );
          });
          setValue("subCounty", result.data.name, {
            shouldDirty: true,
            shouldValidate: true,
          });
          setValue("parish", "", {
            shouldDirty: true,
            shouldValidate: true,
          });
          setValue("village", "", {
            shouldDirty: true,
            shouldValidate: true,
          });
        } else if (locationDialogType === "parish") {
          if (!watchedConstituency) {
            throw new Error("Select or create a constituency first, then create the parish or ward.");
          }
          if (!watchedSubCounty) {
            throw new Error("Select or create a sub county first, then create the parish or ward.");
          }

          const response = await fetch("/api/v1/location-catalog", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              kind: "parish",
              name: value,
              constituencyName: watchedConstituency,
              subCountyName: watchedSubCounty,
            }),
          });
          const result = await response.json();
          if (!response.ok || !result?.success) {
            throw new Error(result?.error || "Failed to create parish");
          }

          setLocationCatalog((current) =>
            current.map((entry) =>
              entry.name === watchedConstituency
                ? {
                    ...entry,
                    subCounties: entry.subCounties.map((subCounty) =>
                      subCounty.name === watchedSubCounty
                        ? {
                            ...subCounty,
                            parishes: [
                              ...subCounty.parishes.filter((parish) => parish.name !== result.data.name),
                              result.data,
                            ].sort((a, b) => a.name.localeCompare(b.name)),
                          }
                        : subCounty,
                    ),
                  }
                : entry,
            ),
          );
          setValue("parish", result.data.name, {
            shouldDirty: true,
            shouldValidate: true,
          });
          setValue("village", "", {
            shouldDirty: true,
            shouldValidate: true,
          });
        } else {
          if (!watchedConstituency) {
            throw new Error("Select or create a constituency first, then create the village.");
          }
          if (!watchedSubCounty) {
            throw new Error("Select or create a sub county first, then create the village.");
          }
          if (!watchedParish) {
            throw new Error("Select or create a parish first, then create the village.");
          }

          const response = await fetch("/api/v1/location-catalog", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              kind: "village",
              name: value,
              constituencyName: watchedConstituency,
              subCountyName: watchedSubCounty,
              parishName: watchedParish,
            }),
          });
          const result = await response.json();
          if (!response.ok || !result?.success) {
            throw new Error(result?.error || "Failed to create village");
          }

          setLocationCatalog((current) =>
            current.map((entry) =>
              entry.name === watchedConstituency
                ? {
                    ...entry,
                    subCounties: entry.subCounties.map((subCounty) =>
                      subCounty.name === watchedSubCounty
                        ? {
                            ...subCounty,
                            parishes: subCounty.parishes.map((parish) =>
                              parish.name === watchedParish
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
          setValue("village", result.data.name, {
            shouldDirty: true,
            shouldValidate: true,
          });
        }

        setLocationDialogOpen(false);
        setLocationDialogType(null);
        setLocationDraft("");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to save location");
      } finally {
        setLocationLoading(false);
      }
    })();
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          reset();
          setImageUrl("");
          setPhone("+256 ");
          setFingerprintTemplate("");
          setFingerprintCapture(null);
          setCapturedFile(null);
          onClose();
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
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(saveUser)}
          className="flex-1 overflow-y-auto"
        >
          <div className="space-y-6 p-1">
            {/* Profile Photo Section */}
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
                    } ${isImageUploading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => {
                      if (!isImageUploading) {
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
                          disabled={isImageUploading}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="text-center p-8">
                        <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                        <p className="text-sm font-medium text-muted-foreground mb-1">
                          {isImageUploading
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
                      disabled={isImageUploading}
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
                      disabled={isImageUploading}
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
                    disabled={isImageUploading}
                  />
                </div>
              </div>
            </div>

            {/* Personal Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <User className="h-5 w-5" />
                Personal Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TextInput
                  register={register}
                  errors={errors}
                  label="Surname *"
                  name="lastName"
                  icon={User}
                  isRequired={true}
                />
                <TextInput
                  register={register}
                  errors={errors}
                  label="Other Names"
                  name="firstName"
                  icon={User}
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
                  label="Email Address (Optional)"
                  name="email"
                  type="email"
                  icon={Mail}
                  isRequired={false}
                />
                <TextInput
                  register={register}
                  errors={errors}
                  label="Date of Birth *"
                  name="dateOfBirth"
                  type="date"
                  icon={Calendar}
                  isRequired={true}
                />
                {isMemberRole && (
                  <div className="space-y-2">
                    <Label htmlFor="gender">Gender *</Label>
                    <select
                      id="gender"
                      {...register("gender", {
                        required: isMemberRole ? "Gender is required" : false,
                      })}
                      className="block w-full rounded-md border-0 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6 text-sm"
                    >
                      <option value="">Select gender</option>
                      {Object.values(Gender).map((gender) => (
                        <option key={gender} value={gender}>
                          {gender.charAt(0) + gender.slice(1).toLowerCase()}
                        </option>
                      ))}
                    </select>
                    {errors.gender && (
                      <span className="text-xs text-red-600">
                        Gender is required
                      </span>
                    )}
                  </div>
                )}
                {isMemberRole && (
                  <>
                    <TextInput
                      register={register}
                      errors={errors}
                      label="Registration Date *"
                      name="registrationDate"
                      type="date"
                      icon={Calendar}
                      isRequired={true}
                    />
                    <TextInput
                      register={register}
                      errors={errors}
                      label="NIN / ID Card"
                      name="idCard"
                      icon={CreditCard}
                      isRequired={false}
                      maxLength={14}
                      registerOptions={{
                        validate: (value) => {
                          if (!isMemberRole) return true;
                          const normalized = normalizeMemberNin(value);
                          if (!normalized) {
                            return "NIN / ID Card is required for members";
                          }
                          if (!watchedDateOfBirth || !watchedGender) {
                            return "Select date of birth and gender before entering the NIN";
                          }
                          return isMemberNinPrefixValid(
                            normalized,
                            watchedDateOfBirth,
                            watchedGender,
                          )
                            ? true
                            : `NIN must start with ${getMemberNinPrefix(watchedDateOfBirth, watchedGender) || "the expected prefix"}`;
                        },
                      }}
                      onChange={(event) => {
                        const normalized =
                          normalizeMemberNin(event.target.value) || "";
                        if (normalized !== event.target.value) {
                          setValue("idCard", normalized, {
                            shouldDirty: true,
                            shouldValidate: true,
                          });
                        }
                      }}
                    />
                    {expectedMemberNinPrefix && (
                      <p className="text-xs text-muted-foreground">
                        Expected format starts with {expectedMemberNinPrefix} and must be 15 characters.
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Additional Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Additional Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TextInput
                  register={register}
                  errors={errors}
                  label={userRole === "MEMBER" ? "Occupation Title" : "Job Title"}
                  name="jobTitle"
                  icon={User}
                />
                
                {userRole === "AGENT" && (
                  <TextInput
                    register={register}
                    errors={errors}
                    label="Area of Operation"
                    name="areaOfOperation"
                    icon={User}
                  />
                )}
                
                {userRole !== "AGENT" && (
                  <FormSelectInput
                    label="Branch *"
                    options={branchOptions}
                    option={selectedBranch}
                    setOption={setSelectedBranch}
                    toolTipText="Add New Branch"
                    href="/dashboard/branches"
                  />
                )}

                {isMemberRole && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="district">District</Label>
                      <div className="flex gap-2">
                        <div className="w-full">
                          <Select
                            isSearchable
                            primaryColor="blue"
                            value={selectedDistrictOption}
                            onChange={(item) => {
                              const next = !Array.isArray(item) ? item?.value?.toString() || "" : "";
                              setValue("district", next, {
                                shouldDirty: true,
                                shouldValidate: true,
                              });
                            }}
                            options={searchableDistrictOptions}
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
                      <p className="text-xs text-muted-foreground">
                        Select a district, or click the plus button to create a new one.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="constituency">Constituency</Label>
                      <div className="flex gap-2">
                        <div className="w-full">
                          <Select
                            isSearchable
                            primaryColor="blue"
                            value={selectedConstituencyOption}
                            onChange={(item) => {
                              const next = !Array.isArray(item) ? item?.value?.toString() || "" : "";
                              setValue("constituency", next, {
                                shouldDirty: true,
                                shouldValidate: true,
                              });
                              setValue("subCounty", "", {
                                shouldDirty: true,
                                shouldValidate: true,
                              });
                              setValue("parish", "", {
                                shouldDirty: true,
                                shouldValidate: true,
                              });
                              setValue("village", "", {
                                shouldDirty: true,
                                shouldValidate: true,
                              });
                            }}
                            options={searchableConstituencyOptions}
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
                      <p className="text-xs text-muted-foreground">
                        Search for a constituency, or click the plus button to create a new one.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="subCounty">Sub County / Town Council</Label>
                      <div className="flex gap-2">
                        <div className="w-full">
                          <Select
                            isSearchable
                            primaryColor="blue"
                            value={selectedSubCountyOption}
                            onChange={(item) => {
                              const next = !Array.isArray(item) ? item?.value?.toString() || "" : "";
                              setValue("subCounty", next, {
                                shouldDirty: true,
                                shouldValidate: true,
                              });
                              if (
                                watchedParish &&
                                !getBukonzoEastParishes(watchedConstituency, next).includes(watchedParish)
                              ) {
                                setValue("parish", "", {
                                  shouldDirty: true,
                                  shouldValidate: true,
                                });
                                setValue("village", "", {
                                  shouldDirty: true,
                                  shouldValidate: true,
                                });
                              }
                            }}
                            options={searchableSubCountyOptions}
                            placeholder="select subcounty/town council"
                            isDisabled={!watchedConstituency}
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
                            if (!watchedConstituency) {
                              toast.error("Select or create a constituency first.");
                              return;
                            }
                            setLocationDialogType("subCounty");
                            setLocationDraft("");
                            setLocationDialogOpen(true);
                          }}
                          aria-label="Create new sub county / town council"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Search for an area, or click the plus button to create a new one.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="parish">Parish / Ward</Label>
                      <div className="flex gap-2">
                        <div className="w-full">
                          <Select
                            isSearchable
                            primaryColor="blue"
                            value={selectedParishOption}
                            onChange={(item) => {
                              const next = !Array.isArray(item) ? item?.value?.toString() || "" : "";
                              setValue("parish", next, {
                                shouldDirty: true,
                                shouldValidate: true,
                              });
                              setValue("village", "", {
                                shouldDirty: true,
                                shouldValidate: true,
                              });
                            }}
                            options={searchableParishOptions}
                            placeholder={
                              watchedSubCounty
                                ? "select parish/ward"
                                : "Select sub county first"
                            }
                            isDisabled={!watchedSubCounty}
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
                            if (!watchedConstituency) {
                              toast.error("Select or create a constituency first.");
                              return;
                            }
                            if (!watchedSubCounty) {
                              toast.error("Select or create a sub county first.");
                              return;
                            }
                            setLocationDialogType("parish");
                            setLocationDraft("");
                            setLocationDialogOpen(true);
                          }}
                          aria-label="Create new parish / ward"
                          disabled={!watchedSubCounty || locationLoading}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Search for a parish, or click the plus button to create a missing one.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="village">Village</Label>
                      <div className="flex gap-2">
                        <div className="w-full">
                          <Select
                            isSearchable
                            primaryColor="blue"
                            value={selectedVillageOption}
                            onChange={(item) => {
                              const next = !Array.isArray(item) ? item?.value?.toString() || "" : "";
                              setValue("village", next, {
                                shouldDirty: true,
                                shouldValidate: true,
                              });
                            }}
                            options={searchableVillageOptions}
                            placeholder={watchedParish ? "select village" : "Select parish first"}
                            isDisabled={!watchedParish}
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
                            if (!watchedConstituency) {
                              toast.error("Select or create a constituency first.");
                              return;
                            }
                            if (!watchedSubCounty) {
                              toast.error("Select or create a sub county first.");
                              return;
                            }
                            if (!watchedParish) {
                              toast.error("Select or create a parish first.");
                              return;
                            }
                            setLocationDialogType("village");
                            setLocationDraft("");
                            setLocationDialogOpen(true);
                          }}
                          aria-label="Create new village"
                          disabled={!watchedParish || locationLoading}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Search for a village, or click the plus button to create a missing one.
                      </p>
                    </div>
                    <TextInput
                      register={register}
                      errors={errors}
                      label="Postal Address"
                      name="postalAddress"
                      icon={Mail}
                    />
                    <TextInput
                      register={register}
                      errors={errors}
                      label="Next of Kin Name"
                      name="nokName"
                      icon={User}
                    />
                    <TextInput
                      register={register}
                      errors={errors}
                      label="Next of Kin Relationship"
                      name="nokRelationship"
                      icon={User}
                    />
                    <TextInput
                      register={register}
                      errors={errors}
                      label="Next of Kin Phone"
                      name="nokPhone"
                      icon={Phone}
                    />
                  </>
                )}
                
                {/* Admin Role Selection */}
                {isAdmin && (
                  <div className="space-y-2">
                    <Label htmlFor="role">User Role</Label>
                    <div className="relative">
                      <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <select
                        id="role"
                        {...register("role")}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pl-10 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                         {Object.values(UserRole).map((r) => (
                           <option key={r} value={r}>
                             {r.replace(/_/g, " ")}
                           </option>
                         ))}
                      </select>
                    </div>
                  </div>
                )}

                {!editingId && (
                  <div className="space-y-2">
                    <Label htmlFor="password">Password *</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        {...register("password", {
                          required: "Password is required",
                          minLength: {
                            value: 6,
                            message: "Password must be at least 6 characters",
                          },
                        })}
                        placeholder="Enter password"
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
                )}
              </div>
            </div>

            {isMemberRole && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5" />
                  Fingerprint Enrollment
                </h3>

                <FingerprintScanner
                  label="Enrollment Scan"
                  onCapture={(data) => {
                    if (!data.NativeTemplateBase64) {
                      toast.error("Native template unavailable.", {
                        description: data.bridgeError || "Start fingerprint-bridge/server.js and retry.",
                      });
                      return;
                    }
                    setFingerprintCapture(data);
                    setFingerprintTemplate(data.NativeTemplateBase64);
                  }}
                  onReset={() => {
                    setFingerprintCapture(null);
                    setFingerprintTemplate("");
                  }}
                  disabled={loading || isImageUploading}
                />

                {fingerprintCapture && (
                  <p className="text-sm text-emerald-600">
                    Fingerprint captured successfully. Quality: {fingerprintCapture.ImageQuality}/100
                  </p>
                )}
              </div>
            )}

          </div>
        </form>

        <Dialog
          open={locationDialogOpen}
          onOpenChange={(open) => {
            setLocationDialogOpen(open);
            if (!open) {
              setLocationDialogType(null);
              setLocationDraft("");
            }
          }}
        >
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
                  Parish: {watchedParish || "Select or create a parish first"}
                </div>
              )}
              {locationDialogType === "parish" && (
                <div className="rounded-md border bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  Sub county: {watchedSubCounty || "Select or create a sub county first"}
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

        <DialogFooter className="border-t pt-4">
          <div className="flex items-center justify-between w-full">
            <p className="text-sm text-muted-foreground">
              {branchesLoading
                ? "Loading branches..."
                : imageUrl
                  ? "Photo uploaded"
                  : "No photo uploaded"}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  reset();
                  setImageUrl("");
                  setPhone("+256 ");
                  setFingerprintTemplate("");
                  setFingerprintCapture(null);
                  setCapturedFile(null);
                  onClose();
                }}
                disabled={loading || isImageUploading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                onClick={handleSubmit(saveUser)}
                disabled={
                  loading ||
                  isImageUploading ||
                  branchesLoading ||
                  (isMemberRole && !fingerprintTemplate)
                }
              >
                {loading
                  ? "Saving..."
                  : isImageUploading
                    ? "Uploading..."
                    : branchesLoading
                      ? "Loading..."
                      : editingId
                        ? `Update ${getRoleDisplayName().name}`
                        : `Create ${getRoleDisplayName().name}`}
              </Button>
            </div>
          </div>
        </DialogFooter>

        {/* Camera Modal */}
        {isCameraOpen && (
          <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
            <div className="bg-background rounded-lg max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Capture Photo</h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={closeCamera}
                  disabled={isImageUploading}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {availableCameras.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="camera-device">Camera source</Label>
                    <select
                      id="camera-device"
                      value={selectedCameraId}
                      onChange={(e) => {
                        void handleCameraChange(e.target.value);
                      }}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring"
                      disabled={isImageUploading || !isCameraOpen}
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

                <p className="text-sm text-muted-foreground text-center">
                  {capturedPreview
                    ? "Review the image before uploading."
                    : isCameraReady
                      ? "Camera is ready. Position the subject and capture the frame."
                      : "Starting camera... please wait."}
                </p>
              </div>

              <div className="border-t px-6 py-4 bg-background">
                <div className="flex flex-wrap gap-2 justify-center">
                  {!capturedPreview ? (
                    <Button
                      type="button"
                      onClick={capturePhoto}
                      disabled={!isCameraReady}
                    >
                      <Camera className="h-4 w-4 mr-2" />
                      Capture
                    </Button>
                  ) : (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setCapturedPreview(null);
                          setCapturedFile(null);
                        }}
                        disabled={isImageUploading}
                      >
                        Retake
                      </Button>
                      <Button
                        type="button"
                        onClick={() => uploadCapturedImage()}
                        disabled={isImageUploading}
                      >
                        {isImageUploading ? "Uploading..." : "Use This Image"}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
