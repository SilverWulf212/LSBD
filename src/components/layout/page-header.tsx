import Image from "next/image";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
  image?: string;
  imageAlt?: string;
}

export function PageHeader({ title, description, children, image, imageAlt }: PageHeaderProps) {
  return (
    <div className="relative bg-[#CAF0F8]/40 border-b overflow-hidden">
      {image && (
        <div className="absolute inset-0 z-0">
          <Image
            src={image}
            alt={imageAlt || ""}
            fill
            className="object-cover opacity-15"
            sizes="100vw"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-r from-white/90 to-white/70" />
        </div>
      )}
      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="mb-3">
          <Breadcrumbs />
        </div>
        <h1 className="font-[family-name:var(--font-oswald)] text-2xl sm:text-3xl lg:text-4xl font-bold text-[#005f8f] uppercase tracking-wide">
          {title}
        </h1>
        {description && (
          <p className="mt-2 text-base sm:text-lg text-[#495057] max-w-3xl">
            {description}
          </p>
        )}
        {children && <div className="mt-4">{children}</div>}
      </div>
    </div>
  );
}
