import { Breadcrumbs } from "@/components/layout/breadcrumbs";

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
}

export function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <div className="bg-[#CAF0F8]/40 border-b">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
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
