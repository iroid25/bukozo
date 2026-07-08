export type ItemCreateDTO = {
  name: string;
  slug: string;
  orgId: string;
  sku: string;
  costPrice: number;
  sellingPrice: number;
  thumbnail?: string;
};

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string | null;
}

// types/item.ts
export interface BriefItemDTO {
  id: string;
  name: string;
  slug: string;
  sellingPrice: number;
  costPrice: number;
  salesCount: number;
  salesTotal: number;
  createdAt: Date;
  thumbnail: string | null;
}
interface Pagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

interface BriefItemsData {
  data: BriefItemDTO[];
  pagination: Pagination;
}

export type BriefItemsResponse = ApiResponse<BriefItemsData>;

interface ProductData {
  id: string;
  name: string;
  slug: string;
  sku: string;
  barcode?: string;
  description?: string;
  dimensions?: string;
  weight?: number;
  upc?: string;
  ean?: string;
  mpn?: string;
  isbn?: string;
  thumbnail?: string;
  imageUrls: string[];
  categoryId?: string;
  salesCount: number;
  salesTotal: number;
  orgId: string;
  tax?: number;
  taxRateId?: string;
  brandId?: string;
  unitId?: string;
  unitOfMeasure?: string;
  costPrice: number;
  sellingPrice: number;
  minStockLevel: number;
  maxStockLevel?: number;
  isActive: boolean;
  isSerialTracked: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ProductResponse {
  success: boolean;
  data: ProductData;
  error: string | null;
}

// For a list of products, you might need this type
interface ProductListResponse {
  success: boolean;
  data: ProductData[];
  error: string | null;
}

export type { ProductData, ProductResponse, ProductListResponse };
