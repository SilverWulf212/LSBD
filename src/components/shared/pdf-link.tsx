import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatFileSize } from "@/lib/utils";

interface PdfLinkProps {
  href: string;
  children: React.ReactNode;
  fileSize?: number;
  className?: string;
}

export function PdfLink({ href, children, fileSize, className }: PdfLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1.5 text-[#005f8f] underline underline-offset-2 hover:text-[#003f5f] transition-colors",
        "focus-visible:ring-2 focus-visible:ring-[#0077B6] focus-visible:ring-offset-2 focus-visible:outline-none rounded",
        className
      )}
    >
      <FileText className="h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
      {children}
      {fileSize && (
        <span className="text-xs text-gray-500 font-normal">
          ({formatFileSize(fileSize)})
        </span>
      )}
      <span className="sr-only"> (PDF, opens in a new tab)</span>
    </a>
  );
}
