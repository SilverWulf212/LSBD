"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, FileText, LogIn, Search, Shield, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EXTERNAL_LINKS } from "@/lib/constants";

const SLIDES = [
  {
    image: "/images/heroes/hero-dentist-patient.png",
    alt: "Dentist consulting with a patient using a digital tablet",
    headline: "Protecting Louisiana's Public Health",
    subtext:
      "Regulating the professions of dentistry and dental hygiene in the State of Louisiana since 1894.",
  },
  {
    image: "/images/people/hygienist-smiling.png",
    alt: "Dental hygienist smiling in a modern clinical setting",
    headline: "Licensing Louisiana's Dental Professionals",
    subtext:
      "Streamlined pathways for dentists, hygienists, and dental assistants to serve communities across the state.",
  },
  {
    image: "/images/heroes/hero-consultation.png",
    alt: "Dental professional reviewing patient information on a tablet",
    headline: "Standards of Excellence in Dental Care",
    subtext:
      "Continuing education, professional oversight, and public accountability for over 4,500 licensed practitioners.",
  },
  {
    image: "/images/heroes/hero-clinical.png",
    alt: "Modern dental clinical environment with professional equipment",
    headline: "Committed to Modern Regulation",
    subtext:
      "Transparent governance, accessible resources, and responsive service for dental professionals and the public.",
  },
];

const INTERVAL = 6000;

export function HeroCarousel() {
  const [current, setCurrent] = React.useState(0);
  const [isPaused, setIsPaused] = React.useState(false);
  const [direction, setDirection] = React.useState<"left" | "right">("right");
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = React.useCallback(() => {
    timerRef.current = setInterval(() => {
      setDirection("right");
      setCurrent((prev) => (prev + 1) % SLIDES.length);
    }, INTERVAL);
  }, []);

  const stopTimer = React.useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  React.useEffect(() => {
    if (!isPaused) startTimer();
    return () => stopTimer();
  }, [isPaused, startTimer, stopTimer]);

  const goTo = (index: number) => {
    stopTimer();
    setDirection(index > current ? "right" : "left");
    setCurrent(index);
    if (!isPaused) startTimer();
  };

  const prev = () => {
    stopTimer();
    setDirection("left");
    setCurrent((c) => (c - 1 + SLIDES.length) % SLIDES.length);
    if (!isPaused) startTimer();
  };

  const next = () => {
    stopTimer();
    setDirection("right");
    setCurrent((c) => (c + 1) % SLIDES.length);
    if (!isPaused) startTimer();
  };

  const togglePause = () => setIsPaused((p) => !p);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Homepage hero carousel"
      className="relative w-full overflow-hidden bg-[#003f5f]"
    >
      {/* Slides */}
      <div className="relative h-[520px] sm:h-[560px] md:h-[600px] lg:h-[650px]">
        {SLIDES.map((slide, i) => (
          <div
            key={i}
            role="group"
            aria-roledescription="slide"
            aria-label={`Slide ${i + 1} of ${SLIDES.length}: ${slide.headline}`}
            aria-hidden={i !== current}
            className={cn(
              "absolute inset-0 transition-all duration-700 ease-in-out",
              i === current
                ? "opacity-100 translate-x-0 z-10"
                : direction === "right"
                  ? "opacity-0 translate-x-full z-0"
                  : "opacity-0 -translate-x-full z-0"
            )}
          >
            {/* Background image with overlay */}
            <div className="absolute inset-0">
              <Image
                src={slide.image}
                alt={slide.alt}
                fill
                className="object-cover"
                priority={i === 0}
                sizes="100vw"
              />
              {/* Gradient overlay for text legibility */}
              <div className="absolute inset-0 bg-gradient-to-r from-[#003049]/90 via-[#003049]/70 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#003049]/60 via-transparent to-[#003049]/30" />
            </div>

            {/* Content */}
            <div className="relative z-20 h-full flex items-center">
              <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 w-full">
                <div className="max-w-2xl">
                  <div
                    className={cn(
                      "transition-all duration-700 delay-200",
                      i === current
                        ? "opacity-100 translate-y-0"
                        : "opacity-0 translate-y-8"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <Shield className="h-5 w-5 text-[#CAF0F8]" aria-hidden="true" />
                      <span className="text-[#CAF0F8] text-xs sm:text-sm font-medium uppercase tracking-[0.2em]">
                        Established 1894 &bull; Baton Rouge, Louisiana
                      </span>
                    </div>
                    <h2 className="font-[family-name:var(--font-oswald)] text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white uppercase tracking-wide leading-[1.1]">
                      {slide.headline}
                    </h2>
                    <p className="mt-4 sm:mt-6 text-base sm:text-lg md:text-xl text-white/85 leading-relaxed max-w-xl">
                      {slide.subtext}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* CTA Buttons — persistent across slides */}
      <div className="absolute bottom-0 left-0 right-0 z-30">
        <div className="bg-gradient-to-t from-[#003049]/95 to-transparent pt-6 pb-3 sm:pt-12 sm:pb-6 lg:pt-16 lg:pb-8">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {/* Primary CTAs */}
              <div className="flex flex-wrap gap-3">
                <Button
                  asChild
                  size="lg"
                  className="bg-white text-[#005f8f] hover:bg-[#CAF0F8] font-[family-name:var(--font-oswald)] uppercase tracking-wide min-h-[44px] px-3 text-xs sm:min-h-[48px] sm:px-6 sm:text-sm font-semibold shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-[1.02]"
                >
                  <a
                    href={EXTERNAL_LINKS.dentistLogin}
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
                  className="bg-[#0077B6] text-white hover:bg-[#005f8f] border-2 border-white/30 font-[family-name:var(--font-oswald)] uppercase tracking-wide min-h-[44px] px-3 text-xs sm:min-h-[48px] sm:px-6 sm:text-sm font-semibold shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-[1.02]"
                >
                  <a
                    href={EXTERNAL_LINKS.dentistLogin}
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
                  className="bg-[#0077B6] text-white hover:bg-[#005f8f] border-2 border-white/30 font-[family-name:var(--font-oswald)] uppercase tracking-wide min-h-[44px] px-3 text-xs sm:min-h-[48px] sm:px-6 sm:text-sm font-semibold shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-[1.02]"
                >
                  <Link href="/public/verify">
                    <Search className="h-5 w-5 mr-2" aria-hidden="true" />
                    Verify a License
                  </Link>
                </Button>
              </div>

              {/* Carousel controls */}
              <div className="flex items-center gap-1 sm:gap-2 ml-auto">
                <button
                  onClick={togglePause}
                  aria-label={isPaused ? "Play carousel" : "Pause carousel"}
                  className="p-2 text-white/70 hover:text-white transition-colors rounded-full hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#003049] min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  {isPaused ? (
                    <Play className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Pause className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
                <button
                  onClick={prev}
                  aria-label="Previous slide"
                  className="p-2 text-white/70 hover:text-white transition-colors rounded-full hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#003049] min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                </button>
                {/* Dots */}
                <div className="flex gap-2" role="tablist" aria-label="Carousel slides">
                  {SLIDES.map((_, i) => (
                    <button
                      key={i}
                      role="tab"
                      aria-selected={i === current}
                      aria-label={`Go to slide ${i + 1}`}
                      onClick={() => goTo(i)}
                      className={cn(
                        "transition-all duration-300 rounded-full focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#003049] min-h-[44px] min-w-[44px] flex items-center justify-center",
                      )}
                    >
                      <span
                        className={cn(
                          "block rounded-full transition-all duration-300",
                          i === current
                            ? "w-8 h-2 bg-white"
                            : "w-2 h-2 bg-white/40 hover:bg-white/70"
                        )}
                      />
                    </button>
                  ))}
                </div>
                <button
                  onClick={next}
                  aria-label="Next slide"
                  className="p-2 text-white/70 hover:text-white transition-colors rounded-full hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#003049] min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <ChevronRight className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
