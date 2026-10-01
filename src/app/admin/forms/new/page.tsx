import { requireCapability } from "@/lib/auth-utils";
import React from "react";
import Link from "next/link";
import { FormEntryForm } from "@/components/admin/form-entry-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "New Form | Admin" };

export default async function NewFormPage() {
  await requireCapability("cms.write");
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild aria-label="Back to forms">
          <Link href="/admin/forms">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">New Form</h1>
          <p className="text-sm text-muted-foreground">Add a new downloadable form</p>
        </div>
      </div>
      <FormEntryForm />
    </div>
  );
}
