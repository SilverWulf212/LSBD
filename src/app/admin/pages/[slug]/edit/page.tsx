import { requireCapability } from "@/lib/auth-utils";
import React from "react";
import Link from "next/link";
import { getPageSectionsBySlug } from "@/actions/pages";
import { PageSectionEditor } from "./page-section-editor";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "Edit Page Content | Admin" };

export default async function EditPageSectionsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireCapability("cms.read");
  const { slug } = await params;
  const sections = await getPageSectionsBySlug(slug);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild aria-label="Back to pages">
          <Link href="/admin/pages">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">Edit Page: /{slug}</h1>
          <p className="text-sm text-muted-foreground">
            {sections.length} editable section{sections.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {sections.length === 0 ? (
        <div className="rounded-md border p-12 text-center text-muted-foreground">
          No editable sections found for this page.
        </div>
      ) : (
        <PageSectionEditor sections={sections} pageSlug={slug} />
      )}
    </div>
  );
}
