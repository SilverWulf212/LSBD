import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  children,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 text-center",
        className
      )}
    >
      <div className="rounded-full bg-[#CAF0F8] p-4 mb-4">
        {icon || <Inbox className="h-8 w-8 text-[#0077B6]" aria-hidden="true" />}
      </div>
      <h3 className="font-[family-name:var(--font-oswald)] text-lg font-semibold text-[#495057] uppercase tracking-wide">
        {title}
      </h3>
      {description && (
        <p className="mt-1 text-sm text-gray-500 max-w-sm">{description}</p>
      )}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
