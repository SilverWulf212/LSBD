import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getForm } from "@/actions/forms";
import { FormEntryForm } from "@/components/admin/form-entry-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "Edit Form | Admin" };

export default async function EditFormPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const formEntry = await getForm(Number(id));
  if (!formEntry) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild aria-label="Back to forms">
          <Link href="/admin/forms">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">Edit Form</h1>
          <p className="text-sm text-muted-foreground">{formEntry.name}</p>
        </div>
      </div>
      <FormEntryForm formEntry={formEntry} />
    </div>
  );
}
