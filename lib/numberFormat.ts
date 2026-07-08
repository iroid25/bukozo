/**
 * Format a number with comma separators
 * @param value - The value to format (string or number)
 * @returns Formatted string with commas
 */
export function formatNumberWithCommas(value: string | number): string {
  if (!value && value !== 0) return "";
  
  // Convert to string and remove existing commas
  const stringValue = String(value).replace(/,/g, "");
  
  // Check if it's a valid number
  if (isNaN(Number(stringValue))) return String(value);
  
  // Split into integer and decimal parts
  const parts = stringValue.split(".");
  const integerPart = parts[0];
  const decimalPart = parts[1];
  
  // Add commas to integer part
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  
  // Combine with decimal part if exists
  return decimalPart !== undefined
    ? `${formattedInteger}.${decimalPart}`
    : formattedInteger;
}

/**
 * Parse a formatted number string to a number
 * @param value - The formatted string with commas
 * @returns Parsed number
 */
export function parseFormattedNumber(value: string): number {
  if (!value) return 0;
  
  // Remove commas and parse
  const cleaned = String(value).replace(/,/g, "");
  const parsed = parseFloat(cleaned);
  
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Format currency with UGX symbol and commas
 * @param value - The value to format
 * @returns Formatted currency string
 */
export function formatCurrency(value: number): string {
  return `UGX ${formatNumberWithCommas(value)}`;
}

/**
 * Handle input change for formatted number fields
 * @param value - The input value
 * @param allowDecimal - Whether to allow decimal points
 * @returns Formatted value
 */
export function handleNumberInput(
  value: string,
  allowDecimal: boolean = false
): string {
  // Remove all non-numeric characters except decimal point
  let cleaned = value.replace(/[^\d.]/g, "");
  
  if (!allowDecimal) {
    cleaned = cleaned.replace(/\./g, "");
  } else {
    // Allow only one decimal point
    const parts = cleaned.split(".");
    if (parts.length > 2) {
      cleaned = parts[0] + "." + parts.slice(1).join("");
    }
  }
  
  return formatNumberWithCommas(cleaned);
}
