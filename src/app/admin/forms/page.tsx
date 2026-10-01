import { requireCapability } from "@/lib/auth-utils";
import React from "react";
import Link from "next/link";
import { getForms } from "@/actions/forms";
import { FormsTable } from "./forms-table";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export const metadata = { title: "Forms | Admin" };

export default async function FormsPage() {
  await requireCapability("cms.read");
  const forms = await getForms();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Downloadable Forms</h1>
          <p className="text-sm text-muted-foreground">
            Manage forms available for download
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/forms/new">
            <Plus className="h-4 w-4" aria-hidden="true" />
            New Form
          </Link>
        </Button>
      </div>
      <FormsTable forms={forms} />
    </div>
  );
}
