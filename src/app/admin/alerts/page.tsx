import React from "react";
import Link from "next/link";
import { getAlerts } from "@/actions/alerts";
import { AlertsTable } from "./alerts-table";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export const metadata = { title: "Alerts | Admin" };

export default async function AlertsPage() {
  const alerts = await getAlerts();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Alerts</h1>
          <p className="text-sm text-muted-foreground">
            Manage site-wide alert banners
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/alerts/new">
            <Plus className="h-4 w-4" aria-hidden="true" />
            New Alert
          </Link>
        </Button>
      </div>
      <AlertsTable alerts={alerts} />
    </div>
  );
}
