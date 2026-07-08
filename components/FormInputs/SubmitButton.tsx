import { cn } from "@/lib/utils";
import { Loader, Plus } from "lucide-react";
import React from "react";
type SubmitButtonProps = {
  title: string;
  loadingTitle?: string;
  className?: string;
  loaderIcon?: any;
  buttonIcon?: any;
  loading: boolean;
  showIcon?: boolean;
  disabled?: boolean | null;
  size?: "default" | "sm" | "lg" | "icon" | null | undefined;
};
export default function SubmitButton({
  title,
  loadingTitle = "Saving Please wait...",
  loading,
  className,
  loaderIcon = Loader,
  buttonIcon = Plus,
  showIcon = true,
  disabled = false,
}: SubmitButtonProps) {
  const LoaderIcon = loaderIcon;
  const ButtonIcon = buttonIcon;
  const isDisabled = disabled ? disabled : false;
  return (
    <>
      {loading ? (
        <button
          type="button"
          disabled
          className={cn(
            "items-center flex justify-center rounded-md bg-[#1e40af]/55 px-3 py-2 text-sm font-semibold leading-6 text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 cursor-not-allowed",
            className
          )}
        >
          <LoaderIcon className="w-4 h-4 animate-spin mr-2" />
          {loadingTitle}
        </button>
      ) : (
        <button
          type="submit"
          disabled={isDisabled}
          className={cn(
            "flex items-center justify-center rounded-md px-3 py-2 text-sm font-semibold leading-6 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
            !disabled
              ? "bg-primary-600 text-white hover:bg-primary-500 focus-visible:outline-primary-600"
              : "bg-gray-300 text-gray-500 cursor-not-allowed",
            className
          )}
        >
          {showIcon && <ButtonIcon className="w-4 h-4 mr-2" />}
          {title}
        </button>
      )}
    </>
  );
}
