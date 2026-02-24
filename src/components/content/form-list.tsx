"use client";

import * as React from "react";
import { Search, FileText, ExternalLink as ExtIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PdfLink } from "@/components/shared/pdf-link";
import { ExternalLink } from "@/components/shared/external-link";
import { FORM_CATEGORIES } from "@/lib/constants";

interface DownloadableForm {
  id: number;
  name: string;
  description?: string | null;
  category: string;
  blobUrl?: string | null;
  fileSizeBytes?: number | null;
  isExternal: boolean;
  externalUrl?: string | null;
}

export function FormList({ forms }: { forms: DownloadableForm[] }) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [activeCategory, setActiveCategory] = React.useState<string | null>(null);

  const filtered = React.useMemo(() => {
    return forms.filter((form) => {
      const matchesSearch =
        !searchQuery ||
        form.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (form.description &&
          form.description.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory =
        !activeCategory || form.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [forms, searchQuery, activeCategory]);

  const grouped = React.useMemo(() => {
    const groups: Record<string, DownloadableForm[]> = {};
    for (const form of filtered) {
      if (!groups[form.category]) groups[form.category] = [];
      groups[form.category].push(form);
    }
    return groups;
  }, [filtered]);

  const categoryLabel = (key: string) => {
    const found = FORM_CATEGORIES.find((c) => c.key === key);
    return found ? found.label : key;
  };

  return (
    <div className="space-y-6">
      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
            aria-hidden="true"
          />
          <Input
            type="search"
            placeholder="Search forms..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 min-h-[44px]"
            aria-label="Search forms by name or description"
          />
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
        <button
          type="button"
          onClick={() => setActiveCategory(null)}
          className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium transition-colors min-h-[36px] focus-visible:ring-2 focus-visible:ring-[#0077B6] focus-visible:ring-offset-2 focus-visible:outline-none ${
            !activeCategory
              ? "bg-[#0077B6] text-white"
              : "bg-gray-100 text-[#495057] hover:bg-gray-200"
          }`}
        >
          All Forms
        </button>
        {FORM_CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            type="button"
            onClick={() => setActiveCategory(cat.key)}
            className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium transition-colors min-h-[36px] focus-visible:ring-2 focus-visible:ring-[#0077B6] focus-visible:ring-offset-2 focus-visible:outline-none ${
              activeCategory === cat.key
                ? "bg-[#0077B6] text-white"
                : "bg-gray-100 text-[#495057] hover:bg-gray-200"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Results */}
      <div aria-live="polite">
        <p className="text-sm text-gray-500 mb-4">
          Showing {filtered.length} of {forms.length} forms
        </p>
      </div>

      {Object.keys(grouped).length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">
          No forms match your search criteria.
        </p>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([category, categoryForms]) => (
            <div key={category}>
              <h3 className="font-[family-name:var(--font-oswald)] text-lg font-semibold text-[#005f8f] uppercase tracking-wide mb-3 border-b border-[#CAF0F8] pb-2">
                {categoryLabel(category)}
              </h3>
              <ul className="space-y-2">
                {categoryForms.map((form) => (
                  <li
                    key={form.id}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <FileText
                      className="h-5 w-5 text-[#0077B6] mt-0.5 shrink-0"
                      aria-hidden="true"
                    />
                    <div className="flex-1 min-w-0">
                      <div>
                        {form.isExternal && form.externalUrl ? (
                          <ExternalLink href={form.externalUrl} className="font-medium text-sm">
                            {form.name}
                          </ExternalLink>
                        ) : form.blobUrl ? (
                          <PdfLink
                            href={form.blobUrl}
                            fileSize={form.fileSizeBytes || undefined}
                            className="font-medium text-sm"
                          >
                            {form.name}
                          </PdfLink>
                        ) : (
                          <span className="font-medium text-sm text-[#1a1a1a]">
                            {form.name}
                          </span>
                        )}
                      </div>
                      {form.description && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {form.description}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
