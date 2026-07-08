// ============================================
// FILE: lib/reconciliation-utils.ts
// ============================================
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    minimumFractionDigits: 0,
  }).format(amount);
};

export const getVarianceStatus = (variance: number) => {
  const absVariance = Math.abs(variance);

  if (absVariance <= 1000) {
    return { isBalanced: true, color: "text-green-600", label: "Balanced" };
  } else if (variance > 1000) {
    return { isBalanced: false, color: "text-blue-600", label: "Overage" };
  } else {
    return { isBalanced: false, color: "text-red-600", label: "Shortage" };
  }
};

export const formatDateSafe = (
  dateString: string | null | undefined
): string => {
  if (!dateString) return "-";

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "-";

    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date);
  } catch {
    return "-";
  }
};
