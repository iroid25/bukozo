"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import CategoryList from "./components/CategoryList";

type Category = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count: {
    expenditureRecords: number;
  };
};

export default function ExpenditureCategoriesClient() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        "/api/v1/expenditure/categories?includeInactive=true",
        {
          credentials: "include",
          cache: "no-store",
        },
      );

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to load categories");
      }

      setCategories(Array.isArray(result.data) ? result.data : []);
    } catch (error) {
      console.error("Error loading expenditure categories:", error);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCategories();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-lg border">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p>Loading expense categories...</p>
        </div>
      </div>
    );
  }

  return <CategoryList categories={categories} onRefresh={loadCategories} />;
}
