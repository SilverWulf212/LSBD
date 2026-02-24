"use client";

import { useEffect } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Button } from "@/components/ui/button";
import { AlertCircle, Home, RefreshCw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <>
      <SiteHeader />
      <main id="main-content" role="main" tabIndex={-1} className="min-h-screen focus:outline-none">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
          <div className="rounded-full bg-red-50 p-4 w-fit mx-auto mb-4">
            <AlertCircle className="h-10 w-10 text-red-600" aria-hidden="true" />
          </div>
          <h1 className="font-[family-name:var(--font-oswald)] text-2xl sm:text-3xl font-bold text-[#005f8f] uppercase tracking-wide">
            Something Went Wrong
          </h1>
          <p className="mt-3 text-base text-[#495057] max-w-md mx-auto">
            We encountered an unexpected error. Please try again or return to the homepage.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              onClick={reset}
              className="bg-[#0077B6] hover:bg-[#005f8f] text-white font-[family-name:var(--font-oswald)] uppercase tracking-wide min-h-[44px]"
            >
              <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
              Try Again
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-[#0077B6] text-[#005f8f] hover:bg-[#CAF0F8] font-[family-name:var(--font-oswald)] uppercase tracking-wide min-h-[44px]"
            >
              <Link href="/">
                <Home className="h-4 w-4 mr-2" aria-hidden="true" />
                Go to Homepage
              </Link>
            </Button>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
