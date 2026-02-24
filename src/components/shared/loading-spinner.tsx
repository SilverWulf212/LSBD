import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  className?: string;
  message?: string;
}

export function LoadingSpinner({ className, message = "Loading..." }: LoadingSpinnerProps) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center py-12", className)}
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <Loader2 className="h-8 w-8 animate-spin text-[#0077B6]" aria-hidden="true" />
      <p className="mt-3 text-sm text-[#495057]">{message}</p>
    </div>
  );
}
