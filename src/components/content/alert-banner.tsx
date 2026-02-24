import { AlertTriangle, Info, AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface AlertBannerProps {
  id: number;
  title: string;
  content: string;
  severity: "info" | "warning" | "critical";
}

const severityConfig = {
  info: {
    bg: "bg-blue-50 border-blue-200",
    icon: Info,
    iconColor: "text-[#0077B6]",
    titleColor: "text-[#005f8f]",
    textColor: "text-blue-800",
  },
  warning: {
    bg: "bg-amber-50 border-amber-200",
    icon: AlertTriangle,
    iconColor: "text-amber-600",
    titleColor: "text-amber-800",
    textColor: "text-amber-700",
  },
  critical: {
    bg: "bg-red-50 border-red-200",
    icon: AlertCircle,
    iconColor: "text-red-600",
    titleColor: "text-red-800",
    textColor: "text-red-700",
  },
};

export function AlertBanner({ title, content, severity }: AlertBannerProps) {
  const config = severityConfig[severity];
  const Icon = config.icon;

  return (
    <div
      role="alert"
      className={cn("border rounded-lg p-4", config.bg)}
    >
      <div className="flex items-start gap-3">
        <Icon
          className={cn("h-5 w-5 mt-0.5 shrink-0", config.iconColor)}
          aria-hidden="true"
        />
        <div className="flex-1 min-w-0">
          <h3
            className={cn(
              "font-[family-name:var(--font-oswald)] font-semibold text-sm uppercase tracking-wide",
              config.titleColor
            )}
          >
            {title}
          </h3>
          <p className={cn("mt-1 text-sm", config.textColor)}>{content}</p>
        </div>
      </div>
    </div>
  );
}

export function AlertBannerList({ alerts }: { alerts: AlertBannerProps[] }) {
  if (alerts.length === 0) return null;

  return (
    <div aria-live="polite" className="space-y-3">
      {alerts.map((alert) => (
        <AlertBanner key={alert.id} {...alert} />
      ))}
    </div>
  );
}
