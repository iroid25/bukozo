import type { Metadata } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
// import FooterBanner from "@/components/Footer";

export const metadata: Metadata = {
  title: "BUTSACCO App",
  description: "Simplify Your Inventory Management with Inventory Pro",
};
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
