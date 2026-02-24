import React from "react";
import Link from "next/link";
import { PublicationForm } from "@/components/admin/publication-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "New Publication | Admin" };

export default function NewPublicationPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild aria-label="Back to publications">
          <Link href="/admin/publications">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">New Publication</h1>
          <p className="text-sm text-muted-foreground">Upload a new publication</p>
        </div>
      </div>
      <PublicationForm />
    </div>
  );
}
