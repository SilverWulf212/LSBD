"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Users, Award, BookOpen, Calendar } from "lucide-react";

const STATS = [
  {
    value: 4500,
    suffix: "+",
    label: "Licensed Professionals",
    description: "Dentists & hygienists across Louisiana",
    icon: Users,
  },
  {
    value: 130,
    suffix: "+",
    label: "Years of Service",
    description: "Protecting the public since 1894",
    icon: Award,
  },
  {
    value: 9,
    suffix: "",
    label: "Congressional Districts",
    description: "Board representation statewide",
    icon: BookOpen,
  },
  {
    value: 4,
    suffix: "",
    label: "Annual Board Meetings",
    description: "Open to the public",
    icon: Calendar,
  },
];

function useCountUp(target: number, duration: number = 2000, startCounting: boolean = false) {
  const [count, setCount] = React.useState(0);
  const frameRef = React.useRef<number>(0);

  React.useEffect(() => {
    if (!startCounting) return;
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      }
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration, startCounting]);

  return count;
}

function StatCard({
  value,
  suffix,
  label,
  description,
  icon: Icon,
  index,
  isVisible,
}: {
  value: number;
  suffix: string;
  label: string;
  description: string;
  icon: React.ElementType;
  index: number;
  isVisible: boolean;
}) {
  const count = useCountUp(value, 2200, isVisible);

  return (
    <div
      className={cn(
        "group relative text-center p-4 sm:p-6 lg:p-8 rounded-2xl transition-all duration-700",
        "bg-white/80 backdrop-blur-sm shadow-sm hover:shadow-lg hover:bg-white",
        "transform hover:-translate-y-1",
        isVisible
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-8"
      )}
      style={{ transitionDelay: isVisible ? `${index * 150}ms` : "0ms" }}
    >
      {/* Accent bar */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-[#0077B6] rounded-b-full transition-all duration-300 group-hover:w-20" />

      <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-[#CAF0F8] text-[#0077B6] mb-4 transition-transform duration-300 group-hover:scale-110">
        <Icon className="h-7 w-7" aria-hidden="true" />
      </div>

      <div className="font-[family-name:var(--font-oswald)] text-3xl sm:text-4xl lg:text-5xl font-bold text-[#005f8f] tracking-tight">
        {count.toLocaleString()}{suffix}
      </div>
      <div className="mt-2 font-[family-name:var(--font-oswald)] text-xs sm:text-sm font-semibold text-[#495057] uppercase tracking-wide sm:tracking-wider leading-tight">
        {label}
      </div>
      <p className="mt-1 text-xs text-[#6b7280] leading-relaxed">
        {description}
      </p>
    </div>
  );
}

export function AnimatedStats() {
  const [isVisible, setIsVisible] = React.useState(false);
  const sectionRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      aria-label="Board statistics"
      className="relative py-16 sm:py-20 overflow-hidden"
    >
      {/* Subtle background pattern */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#CAF0F8]/20 via-[#CAF0F8]/40 to-[#CAF0F8]/20" aria-hidden="true" />
      <div className="absolute inset-0 opacity-[0.03]" aria-hidden="true">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#0077B6" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10 sm:mb-12">
          <h2
            className={cn(
              "font-[family-name:var(--font-oswald)] text-2xl sm:text-3xl font-bold text-[#005f8f] uppercase tracking-wide transition-all duration-700",
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            )}
          >
            Louisiana&apos;s Dental Regulatory Authority
          </h2>
          <p
            className={cn(
              "mt-3 text-[#495057] max-w-2xl mx-auto transition-all duration-700 delay-100",
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            )}
          >
            Dedicated to protecting the public through professional regulation, licensure, and oversight.
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
          {STATS.map((stat, i) => (
            <StatCard key={stat.label} {...stat} index={i} isVisible={isVisible} />
          ))}
        </div>
      </div>
    </section>
  );
}
