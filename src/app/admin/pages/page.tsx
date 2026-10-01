import { requireCapability } from "@/lib/auth-utils";
import React from "react";
import Link from "next/link";
import { getPageSections } from "@/actions/pages";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Layers } from "lucide-react";

export const metadata = { title: "Page Content | Admin" };

// Group sections by page slug
function groupByPage(
  sections: Awaited<ReturnType<typeof getPageSections>>
) {
  const map = new Map<string, typeof sections>();
  for (const section of sections) {
    const existing = map.get(section.pageSlug) ?? [];
    existing.push(section);
    map.set(section.pageSlug, existing);
  }
  return map;
}

export default async function PagesAdminPage() {
  await requireCapability("cms.read");
  const sections = await getPageSections();
  const grouped = groupByPage(sections);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Page Content</h1>
        <p className="text-sm text-muted-foreground">
          Edit content sections for each page
        </p>
      </div>

      {grouped.size === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Layers
              className="mx-auto h-12 w-12 text-muted-foreground/50"
              aria-hidden="true"
            />
            <p className="mt-4 text-muted-foreground">
              No page sections found. Sections are created when pages are set up
              with editable content areas.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from(grouped.entries()).map(([slug, pageSections]) => (
            <Card key={slug}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">/{slug}</CardTitle>
                  <Badge variant="secondary">
                    {pageSections.length} section
                    {pageSections.length !== 1 ? "s" : ""}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 mb-4">
                  {pageSections.map((section) => (
                    <li
                      key={section.id}
                      className="text-sm text-muted-foreground"
                    >
                      {section.title || section.sectionKey}
                    </li>
                  ))}
                </ul>
                <Button variant="outline" size="sm" asChild className="w-full">
                  <Link href={`/admin/pages/${slug}/edit`}>
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    Edit Sections
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
