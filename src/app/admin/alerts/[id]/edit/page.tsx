import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAlert } from "@/actions/alerts";
import { AlertForm } from "@/components/admin/alert-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "Edit Alert | Admin" };

export default async function EditAlertPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const alert = await getAlert(Number(id));
  if (!alert) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild aria-label="Back to alerts">
          <Link href="/admin/alerts">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">Edit Alert</h1>
          <p className="text-sm text-muted-foreground">{alert.title}</p>
        </div>
      </div>
      <AlertForm alert={alert} />
    </div>
  );
}
