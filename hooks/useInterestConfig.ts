/**
 * React hook to fetch and use interest configuration
 */

import { useState, useEffect } from "react";

export interface InterestConfig {
  defaultInterestType: "FLAT_RATE" | "REDUCING_BALANCE";
  defaultLoanInterestRate: number;
  maxInterestRate: number;
  minInterestRate: number;
  allowInterestTypeOverride: boolean;
  savingsInterestRate: number;
  fixedDepositInterestRate: number;
}

export function useInterestConfig() {
  const [config, setConfig] = useState<InterestConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/v1/system/interest-config/client");
      
      if (!response.ok) {
        throw new Error("Failed to fetch interest configuration");
      }

      const data = await response.json();
      setConfig(data);
      setError(null);
    } catch (err: any) {
      console.error("Error fetching interest config:", err);
      setError(err.message);
      // Set default fallback configuration
      setConfig({
        defaultInterestType: "FLAT_RATE",
        defaultLoanInterestRate: 15,
        maxInterestRate: 100,
        minInterestRate: 0,
        allowInterestTypeOverride: true,
        savingsInterestRate: 5,
        fixedDepositInterestRate: 8,
      });
    } finally {
      setLoading(false);
    }
  };

  return { config, loading, error, refetch: fetchConfig };
}
