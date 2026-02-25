"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ArrowRight, Quote } from "lucide-react";

export function ParallaxMission() {
  const [scrollY, setScrollY] = React.useState(0);
  const sectionRef = React.useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = React.useState(false);

  React.useEffect(() => {
    const handleScroll = () => {
      if (sectionRef.current) {
        const rect = sectionRef.current.getBoundingClientRect();
        const offset = window.innerHeight - rect.top;
        setScrollY(offset * 0.15);
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      aria-label="Board mission and history"
      className="relative overflow-hidden"
    >
      {/* Parallax background image */}
      <div className="absolute inset-0 -top-20 -bottom-20" aria-hidden="true">
        <Image
          src="/images/heroes/hero-consultation.png"
          alt=""
          fill
          className="object-cover"
          style={{ transform: `translateY(${scrollY}px)` }}
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-[#003049]/85" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#003049]/20 via-transparent to-[#003049]/20" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left — Mission quote + portrait */}
          <div
            className={cn(
              "transition-all duration-1000",
              isVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-12"
            )}
          >
            <div className="relative">
              {/* Quote icon */}
              <Quote
                className="absolute -top-4 -left-2 h-12 w-12 text-[#CAF0F8]/30 rotate-180"
                aria-hidden="true"
              />
              <blockquote className="relative pl-6 border-l-4 border-[#CAF0F8]/50">
                <p className="text-xl sm:text-2xl lg:text-3xl text-white font-light leading-relaxed italic">
                  To protect the public by regulating the professions of dentistry and dental
                  hygiene in Louisiana in accordance with the Dental Practice Act.
                </p>
              </blockquote>
              <div className="mt-6 pl-6">
                <p className="text-[#CAF0F8] font-[family-name:var(--font-oswald)] text-sm uppercase tracking-[0.2em]">
                  Our Mission
                </p>
                <p className="text-white/70 text-sm mt-1">
                  Louisiana State Board of Dentistry
                </p>
              </div>
            </div>

            {/* Portrait */}
            <div className="mt-10 flex items-center gap-6">
              <div className="relative w-20 h-20 rounded-full overflow-hidden ring-2 ring-[#CAF0F8]/30 ring-offset-4 ring-offset-[#003049] shrink-0">
                <Image
                  src="/images/people/professional-female-wide.png"
                  alt="Dental professional representing Louisiana's dental community"
                  fill
                  className="object-cover object-top"
                />
              </div>
              <div>
                <p className="text-white/90 text-sm leading-relaxed">
                  Serving over <strong className="text-white">4,500 licensed professionals</strong> and{" "}
                  <strong className="text-white">4.6 million Louisiana residents</strong> with integrity,
                  transparency, and dedication to public health.
                </p>
              </div>
            </div>
          </div>

          {/* Right — Action cards */}
          <div
            className={cn(
              "space-y-4 transition-all duration-1000 delay-300",
              isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-12"
            )}
          >
            {[
              {
                title: "For Dental Professionals",
                text: "Manage your license, track CE credits, and stay current with regulatory updates. We're here to support your practice.",
                href: "/dentists",
                cta: "Explore Licensing",
              },
              {
                title: "For the Public",
                text: "Verify a dental professional's license, file a complaint, or learn about your rights as a patient in Louisiana.",
                href: "/public",
                cta: "Public Resources",
              },
              {
                title: "About the Board",
                text: "Learn about our 130+ year history, meet our board members, and review upcoming meeting schedules.",
                href: "/about",
                cta: "Learn More",
              },
            ].map((card, i) => (
              <Link
                key={card.href}
                href={card.href}
                className={cn(
                  "group block p-6 rounded-xl backdrop-blur-md transition-all duration-500",
                  "bg-white/10 hover:bg-white/20 border border-white/10 hover:border-white/25",
                  "focus-visible:ring-2 focus-visible:ring-[#CAF0F8] focus-visible:ring-offset-2 focus-visible:ring-offset-[#003049] focus-visible:outline-none",
                  isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
                )}
                style={{ transitionDelay: isVisible ? `${400 + i * 200}ms` : "0ms" }}
              >
                <h3 className="font-[family-name:var(--font-oswald)] text-lg font-semibold text-white uppercase tracking-wide">
                  {card.title}
                </h3>
                <p className="mt-2 text-white/70 text-sm leading-relaxed">
                  {card.text}
                </p>
                <span className="inline-flex items-center gap-1 mt-3 text-[#CAF0F8] text-sm font-medium group-hover:gap-2 transition-all duration-300">
                  {card.cta}
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
