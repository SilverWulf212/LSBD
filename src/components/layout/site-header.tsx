import Link from "next/link";
import Image from "next/image";
import { LogIn, Search } from "lucide-react";
import { SITE_NAME, EXTERNAL_LINKS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { MainNav } from "@/components/layout/main-nav";
import { MobileNav } from "@/components/layout/mobile-nav";
import { SearchDialog } from "@/components/layout/search-dialog";

export function SiteHeader() {
  return (
    <header role="banner" className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo / Site Name */}
          <div className="flex items-center gap-3">
            <MobileNav />
            <Link
              href="/"
              className="flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-[#0077B6] focus-visible:ring-offset-2 focus-visible:outline-none rounded-md"
            >
              {/* Small logo for mobile */}
              <Image
                src="/images/logos/lsbd-logo-small.webp"
                alt="LSBD"
                width={40}
                height={40}
                className="h-8 w-auto lg:hidden transition-all duration-300 hover:drop-shadow-[0_0_8px_rgba(0,119,182,0.4)]"
                priority
              />
              {/* Full logo for desktop */}
              <Image
                src="/images/logos/lsbd-logo.webp"
                alt="Louisiana State Board of Dentistry"
                width={200}
                height={60}
                className="h-12 w-auto hidden lg:block transition-all duration-300 hover:drop-shadow-[0_0_10px_rgba(0,119,182,0.35)]"
                priority
              />
            </Link>
          </div>

          {/* Desktop Navigation */}
          <MainNav />

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <SearchDialog />

            <Button
              asChild
              size="sm"
              className="hidden sm:inline-flex bg-[#0077B6] hover:bg-[#005f8f] text-white font-[family-name:var(--font-oswald)] uppercase tracking-wide text-xs min-h-[44px] min-w-[44px]"
            >
              <Link href="/public/verify">
                <Search className="h-4 w-4 mr-1" aria-hidden="true" />
                Verify a License
              </Link>
            </Button>

            <Button
              asChild
              size="sm"
              variant="outline"
              className="hidden md:inline-flex border-[#0077B6] text-[#005f8f] hover:bg-[#CAF0F8] font-[family-name:var(--font-oswald)] uppercase tracking-wide text-xs min-h-[44px] min-w-[44px]"
            >
              <a
                href={EXTERNAL_LINKS.dentistLogin}
                target="_blank"
                rel="noopener noreferrer"
              >
                <LogIn className="h-4 w-4 mr-1" aria-hidden="true" />
                Licensee Login
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
