import { requireCapability } from "@/lib/auth-utils";
import React from "react";
import Link from "next/link";
import { getPublications } from "@/actions/publications";
import { PublicationsTable } from "./publications-table";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export const metadata = { title: "Publications | Admin" };

export default async function PublicationsPage() {
  await requireCapability("cms.read");
  const publications = await getPublications();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Publications</h1>
          <p className="text-sm text-muted-foreground">
            Manage newsletters and other publications
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/publications/new">
            <Plus className="h-4 w-4" aria-hidden="true" />
            New Publication
          </Link>
        </Button>
      </div>
      <PublicationsTable publications={publications} />
    </div>
  );
}
