import React from "react";

const InventoryProLogo = ({
  theme = "light",
  className = "",
  width = 400,
  height = 120,
}) => {
  const isDark = theme === "dark";

  // Colors based on theme
  const colors = {
    background: isDark ? "#111827" : "transparent",
    gradientStart: isDark ? "#60a5fa" : "#2563eb",
    gradientEnd: isDark ? "#818cf8" : "#4f46e5",
    textPrimary: isDark ? "#ffffff" : "#1e293b",
    textSecondary: isDark ? "#60a5fa" : "#3b82f6",
    tagline: isDark ? "#94a3b8" : "#64748b",
  };

  return (
    <div className={className}>
      {theme === "light" ? (
        <img
          className="h-14 w-auto"
          src="/logo-white.png"
          alt="inventory log"
        />
      ) : (
        <img className="h-14 w-auto" src="/logo-dark.png" alt="inventory log" />
      )}
    </div>
  );
};

export default InventoryProLogo;
