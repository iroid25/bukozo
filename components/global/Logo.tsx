import Link from "next/link";
import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export default function BukotoSaccoLogo({
  variant = "light",
  href = "/",
  className = "",
  isCollapsed = false,
}: {
  variant?: "dark" | "light";
  href?: string;
  className?: string;
  isCollapsed?: boolean;
}) {
  // SACCO-appropriate colors - professional green and blue
  const primaryColor = variant === "light" ? "text-[#1e40af]" : "text-white"; // Deep blue
  const accentColor = "text-[#059669]"; // Professional green
  const logoBackground =
    variant === "light"
      ? "bg-gradient-to-br from-[#1e40af] to-[#059669]"
      : "bg-gradient-to-br from-[#1e40af] to-[#059669]";

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 transition-all hover:opacity-90 relative",
        isCollapsed ? "justify-center" : "",
        className
      )}
    >
      {/* SACCO Logo Mark - Professional circular design */}
      <div className="relative h-10 w-10 flex-shrink-0">
        <motion.div
          className={cn(
            "rounded-full flex items-center justify-center shadow-lg",
            logoBackground,
            isCollapsed ? "h-10 w-10" : "h-10 w-10"
          )}
          initial={false}
          animate={
            isCollapsed
              ? {
                  scale: [1, 1.02, 1],
                  transition: {
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut",
                  },
                }
              : { scale: 1 }
          }
        >
          <motion.div
            className="text-lg font-bold text-white flex items-center justify-center h-full w-full relative"
            initial={false}
            animate={
              isCollapsed
                ? {
                    rotate: [0, 2, 0],
                    transition: {
                      duration: 4,
                      repeat: Infinity,
                      ease: "easeInOut",
                    },
                  }
                : { rotate: 0 }
            }
          >
            {/* SACCO emblem - "BT" for Bukoto Teachers */}
            <div className="flex flex-col items-center justify-center leading-none">
              <span className="text-xs font-bold">BT</span>
              <div className="w-4 h-0.5 bg-white/60 rounded"></div>
            </div>
          </motion.div>

          {/* Professional ring animation when collapsed */}
          {isCollapsed && (
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-white/30"
              initial={{ opacity: 0 }}
              animate={{
                opacity: [0.3, 0.6, 0.3],
                scale: [1, 1.05, 1],
                transition: {
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                },
              }}
            />
          )}

          {/* Inner glow effect */}
          <div className="absolute inset-1 rounded-full bg-white/10 blur-sm"></div>
        </motion.div>
      </div>

      {/* SACCO Text Branding */}
      {!isCollapsed && (
        <motion.div
          className="flex flex-col justify-center"
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -8 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          {/* Main SACCO Name */}
          <div className="flex items-baseline space-x-1">
            <span className={cn("text-lg font-bold", primaryColor)}>
              bukonzo
            </span>
            <span className={cn("text-lg font-semibold", accentColor)}>
              TEACHERS
            </span>
          </div>

          {/* SACCO Designation */}
          <div className="flex items-center space-x-1 -mt-1">
            <span
              className={cn(
                "text-xs font-semibold tracking-wider uppercase",
                variant === "light" ? "text-gray-600" : "text-gray-300"
              )}
            >
              SACCO
            </span>
            <div
              className={cn(
                "w-1 h-1 rounded-full",
                variant === "light" ? "bg-gray-400" : "bg-gray-400"
              )}
            ></div>
            <span
              className={cn(
                "text-xs tracking-wide",
                variant === "light" ? "text-gray-500" : "text-gray-400"
              )}
            >
              Limited
            </span>
          </div>
        </motion.div>
      )}

      {/* Hover effect overlay */}
      <motion.div
        className="absolute inset-0 rounded-lg bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0"
        whileHover={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      />
    </Link>
  );
}

// Alternative compact version for headers/small spaces
export function BukotoSaccoCompactLogo({
  variant = "light",
  href = "/",
  className = "",
}: {
  variant?: "dark" | "light";
  href?: string;
  className?: string;
}) {
  const primaryColor = variant === "light" ? "text-[#1e40af]" : "text-white";
  const accentColor = "text-[#059669]";

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 transition-all hover:opacity-90",
        className
      )}
    >
      {/* Compact logo mark */}
      <div className="relative h-8 w-8 flex-shrink-0">
        <div className="rounded-lg bg-gradient-to-br from-[#1e40af] to-[#059669] flex items-center justify-center h-full w-full shadow-md">
          <span className="text-white text-xs font-bold">BT</span>
        </div>
      </div>

      {/* Compact text */}
      <div className="flex items-baseline space-x-1">
        <span className={cn("text-sm font-bold", primaryColor)}> bukonzo</span>
        <span className={cn("text-sm font-medium", accentColor)}>SACCO</span>
      </div>
    </Link>
  );
}

// Icon-only version for very small spaces
export function BukotoSaccoIcon({
  variant = "light",
  href = "/",
  className = "",
  size = "md",
}: {
  variant?: "dark" | "light";
  href?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClasses = {
    sm: "h-6 w-6",
    md: "h-8 w-8",
    lg: "h-10 w-10",
  };

  const textSizes = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center justify-center transition-all hover:scale-105 ",
        className
      )}
    >
      <div
        className={cn(
          "rounded-lg bg-gradient-to-br from-[#1e40af] to-[#059669] flex items-center justify-center shadow-lg",
          sizeClasses[size]
        )}
      >
        <div className="flex flex-col items-center justify-center leading-none text-white">
          <span className={cn("font-bold", textSizes[size])}>BT</span>
          {size !== "sm" && (
            <div className="w-3 h-0.5 bg-white/60 rounded mt-0.5"></div>
          )}
        </div>
      </div>
    </Link>
  );
}
