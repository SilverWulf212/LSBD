import React from "react";
import Link from "next/link";
import { AlertForm } from "@/components/admin/alert-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "New Alert | Admin" };

export default function NewAlertPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild aria-label="Back to alerts">
          <Link href="/admin/alerts">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">New Alert</h1>
          <p className="text-sm text-muted-foreground">Create a new alert banner</p>
        </div>
      </div>
      <AlertForm />
    </div>
  );
}
