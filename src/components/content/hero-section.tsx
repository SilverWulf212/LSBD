import Link from "next/link";
import { FileText, LogIn, Search, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EXTERNAL_LINKS } from "@/lib/constants";

export function HeroSection() {
  return (
    <section className="relative bg-gradient-to-br from-[#005f8f] via-[#0077B6] to-[#0096c7] text-white overflow-hidden">
      {/* Decorative background pattern */}
      <div className="absolute inset-0 opacity-10" aria-hidden="true">
        <div className="absolute top-0 left-0 w-96 h-96 bg-white/20 rounded-full -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-white/10 rounded-full translate-x-1/4 translate-y-1/4" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-24">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-6 w-6 text-[#CAF0F8]" aria-hidden="true" />
            <span className="text-[#CAF0F8] text-sm font-medium uppercase tracking-wider">
              Established 1894
            </span>
          </div>
          <h1 className="font-[family-name:var(--font-oswald)] text-3xl sm:text-4xl lg:text-5xl font-bold uppercase tracking-wide leading-tight">
            Louisiana State Board of Dentistry
          </h1>
          <p className="mt-4 text-lg sm:text-xl text-white/90 leading-relaxed max-w-2xl">
            Protecting the public by regulating the professions of dentistry and
            dental hygiene in the State of Louisiana. We oversee licensing,
            continuing education, and professional standards for dental
            professionals across the state.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button
              asChild
              size="lg"
              className="bg-white text-[#005f8f] hover:bg-[#CAF0F8] font-[family-name:var(--font-oswald)] uppercase tracking-wide min-h-[44px] min-w-[44px] text-sm font-semibold shadow-lg"
            >
              <a
                href={EXTERNAL_LINKS.licenseeLogin}
                target="_blank"
                rel="noopener noreferrer"
              >
                <FileText className="h-5 w-5 mr-2" aria-hidden="true" />
                Apply for a License
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-2 border-white text-white hover:bg-white/10 font-[family-name:var(--font-oswald)] uppercase tracking-wide min-h-[44px] min-w-[44px] text-sm font-semibold bg-transparent"
            >
              <a
                href={EXTERNAL_LINKS.licenseeLogin}
                target="_blank"
                rel="noopener noreferrer"
              >
                <LogIn className="h-5 w-5 mr-2" aria-hidden="true" />
                Licensee Login
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-2 border-white text-white hover:bg-white/10 font-[family-name:var(--font-oswald)] uppercase tracking-wide min-h-[44px] min-w-[44px] text-sm font-semibold bg-transparent"
            >
              <Link href="/public/verify">
                <Search className="h-5 w-5 mr-2" aria-hidden="true" />
                Verify a License
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
