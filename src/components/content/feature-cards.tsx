import Link from "next/link";
import {
  ClipboardCheck,
  Search,
  AlertTriangle,
  FileText,
  Calendar,
  Newspaper,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const FEATURES = [
  {
    title: "Licensing",
    description:
      "Apply for or renew a dental, hygiene, or assistant license in Louisiana.",
    href: "/dentists/licensure",
    icon: ClipboardCheck,
    color: "text-[#0077B6]",
    bg: "bg-[#CAF0F8]/50",
  },
  {
    title: "Verify a License",
    description:
      "Look up a dental professional to verify their active license status.",
    href: "/public/verify",
    icon: Search,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
  {
    title: "File a Complaint",
    description:
      "Report concerns about a dental professional to the Board for review.",
    href: "/public/complaints",
    icon: AlertTriangle,
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
  {
    title: "Forms & Applications",
    description:
      "Download applications, permits, and other forms required by the Board.",
    href: "/resources/forms",
    icon: FileText,
    color: "text-purple-600",
    bg: "bg-purple-50",
  },
  {
    title: "Meetings & Minutes",
    description:
      "View upcoming Board meetings, agendas, and past meeting minutes.",
    href: "/resources/meetings",
    icon: Calendar,
    color: "text-rose-600",
    bg: "bg-rose-50",
  },
  {
    title: "News & Updates",
    description:
      "Stay informed with the latest news, rule changes, and Board announcements.",
    href: "/news",
    icon: Newspaper,
    color: "text-indigo-600",
    bg: "bg-indigo-50",
  },
];

export function FeatureCards() {
  return (
    <section aria-labelledby="features-heading">
      <h2
        id="features-heading"
        className="font-[family-name:var(--font-oswald)] text-2xl sm:text-3xl font-bold text-[#005f8f] uppercase tracking-wide text-center mb-8"
      >
        How Can We Help?
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {FEATURES.map((feature) => {
          const Icon = feature.icon;
          return (
            <Link
              key={feature.href}
              href={feature.href}
              className="group focus-visible:ring-2 focus-visible:ring-[#0077B6] focus-visible:ring-offset-2 focus-visible:outline-none rounded-xl"
            >
              <Card className="h-full transition-all duration-200 group-hover:shadow-md group-hover:border-[#0077B6]/30 group-hover:-translate-y-0.5">
                <CardContent className="pt-0">
                  <div className="flex items-start gap-4">
                    <div
                      className={`rounded-lg p-3 ${feature.bg} shrink-0`}
                    >
                      <Icon
                        className={`h-6 w-6 ${feature.color}`}
                        aria-hidden="true"
                      />
                    </div>
                    <div>
                      <h3 className="font-[family-name:var(--font-oswald)] font-semibold text-[#005f8f] uppercase tracking-wide text-base">
                        {feature.title}
                      </h3>
                      <p className="mt-1 text-sm text-[#495057] leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
