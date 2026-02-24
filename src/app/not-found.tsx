import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Button } from "@/components/ui/button";
import { Home, Search, ArrowRight } from "lucide-react";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" role="main" tabIndex={-1} className="min-h-screen focus:outline-none">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
          <p className="font-[family-name:var(--font-oswald)] text-7xl sm:text-8xl font-bold text-[#CAF0F8]">
            404
          </p>
          <h1 className="mt-4 font-[family-name:var(--font-oswald)] text-2xl sm:text-3xl font-bold text-[#005f8f] uppercase tracking-wide">
            Page Not Found
          </h1>
          <p className="mt-3 text-base text-[#495057] max-w-md mx-auto">
            The page you are looking for does not exist or may have been moved. Try one of these helpful links:
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              asChild
              className="bg-[#0077B6] hover:bg-[#005f8f] text-white font-[family-name:var(--font-oswald)] uppercase tracking-wide min-h-[44px]"
            >
              <Link href="/">
                <Home className="h-4 w-4 mr-2" aria-hidden="true" />
                Go to Homepage
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-[#0077B6] text-[#005f8f] hover:bg-[#CAF0F8] font-[family-name:var(--font-oswald)] uppercase tracking-wide min-h-[44px]"
            >
              <Link href="/public/verify">
                <Search className="h-4 w-4 mr-2" aria-hidden="true" />
                Verify a License
              </Link>
            </Button>
          </div>
          <div className="mt-12 text-left max-w-sm mx-auto">
            <h2 className="font-[family-name:var(--font-oswald)] text-sm font-semibold text-[#005f8f] uppercase tracking-wide mb-3">
              Popular Pages
            </h2>
            <ul className="space-y-2">
              {[
                { label: "Dentist Licensure", href: "/dentists/licensure" },
                { label: "Hygienist Licensure", href: "/hygienists/licensure" },
                { label: "License Renewal", href: "/dentists/renewal" },
                { label: "Forms Library", href: "/resources/forms" },
                { label: "Fee Schedule", href: "/resources/fees" },
                { label: "File a Complaint", href: "/public/complaints" },
                { label: "Contact Us", href: "/about/staff" },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="inline-flex items-center gap-1 text-sm text-[#005f8f] hover:text-[#003f5f] transition-colors focus-visible:ring-2 focus-visible:ring-[#0077B6] focus-visible:ring-offset-2 focus-visible:outline-none rounded"
                  >
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
