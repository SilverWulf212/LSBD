import { requireCapability } from "@/lib/auth-utils";
import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublication } from "@/actions/publications";
import { PublicationForm } from "@/components/admin/publication-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "Edit Publication | Admin" };

export default async function EditPublicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireCapability("cms.read");
  const { id } = await params;
  const publication = await getPublication(Number(id));
  if (!publication) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild aria-label="Back to publications">
          <Link href="/admin/publications">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">Edit Publication</h1>
          <p className="text-sm text-muted-foreground">{publication.title}</p>
        </div>
      </div>
      <PublicationForm publication={publication} />
    </div>
  );
}
