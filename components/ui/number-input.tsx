"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatNumberWithCommas, parseFormattedNumber, handleNumberInput } from "@/lib/numberFormat";

export interface NumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value?: string | number;
  onValueChange?: (value: number) => void;
  allowDecimal?: boolean;
  maxDecimals?: number;
}

const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ className, value, onValueChange, allowDecimal = false, maxDecimals = 2, ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState("");

    // Update display value when prop value changes
    React.useEffect(() => {
      if (value !== undefined && value !== null) {
        setDisplayValue(formatNumberWithCommas(value));
      } else {
        setDisplayValue("");
      }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      
      // Handle empty input
      if (inputValue === "") {
        setDisplayValue("");
        onValueChange?.(0);
        return;
      }

      // Format the input
      const formatted = handleNumberInput(inputValue, allowDecimal);
      setDisplayValue(formatted);

      // Parse and call onValueChange
      const numericValue = parseFormattedNumber(formatted);
      onValueChange?.(numericValue);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      // Reformat on blur to ensure consistency
      if (displayValue) {
        const numericValue = parseFormattedNumber(displayValue);
        
        // Handle decimal places
        if (allowDecimal && maxDecimals !== undefined) {
          const fixed = numericValue.toFixed(maxDecimals);
          setDisplayValue(formatNumberWithCommas(fixed));
        } else {
          setDisplayValue(formatNumberWithCommas(numericValue));
        }
      }
      
      props.onBlur?.(e);
    };

    return (
      <Input
        type="text"
        inputMode="decimal"
        ref={ref}
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        className={cn(className)}
        {...props}
      />
    );
  }
);

NumberInput.displayName = "NumberInput";

export { NumberInput };
