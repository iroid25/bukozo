import { Suspense } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import LoanProductDetails from "../components/LoanProductDetail";
import LoanProductDetailsSkeleton from "../components/Loading";

interface PageProps {
  params: Promise<{
    loanProductId: string;
  }>;
}

async function fetchLoanProductDetails(loanProductId: string) {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ||
    requestHeaders.get("host") ||
    "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") || "http";

  const [productResponse, statsResponse] = await Promise.all([
    fetch(`${protocol}://${host}/api/v1/loan-products/${loanProductId}`, {
      cache: "no-store",
    }),
    fetch(
      `${protocol}://${host}/api/v1/loan-products/${loanProductId}/stats`,
      {
        cache: "no-store",
      }
    ),
  ]);

  const [productResult, statsResult] = await Promise.all([
    productResponse.json(),
    statsResponse.json(),
  ]);

  if (!productResponse.ok || !productResult.ok) {
    throw new Error(productResult.error || "Failed to fetch loan product");
  }

  if (!statsResponse.ok || !statsResult.ok) {
    throw new Error(statsResult.error || "Failed to fetch loan product stats");
  }

  return {
    loanProduct: productResult.data,
    stats: statsResult.data,
  };
}

async function LoanProductDetailsData({
  loanProductId,
}: {
  loanProductId: string;
}) {
  try {
    const { loanProduct, stats } = await fetchLoanProductDetails(loanProductId);

    return <LoanProductDetails loanProduct={loanProduct} stats={stats} />;
  } catch (error) {
    console.error("Failed to load loan product details:", error);
    notFound();
  }
}

export default async function LoanProductDetailsPage({ params }: PageProps) {
  const { loanProductId } = await params;

  if (!loanProductId || typeof loanProductId !== "string") {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Suspense fallback={<LoanProductDetailsSkeleton />}>
        <LoanProductDetailsData loanProductId={loanProductId} />
      </Suspense>
    </div>
  );
}
