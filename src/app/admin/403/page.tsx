import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";

export const metadata = {
  title: "Access denied | Admin",
};

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center space-y-4 max-w-md">
        <div className="rounded-full bg-red-50 p-4 w-fit mx-auto">
          <ShieldAlert className="h-8 w-8 text-red-600" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-semibold">Access denied</h1>
        <p className="text-sm text-muted-foreground">
          Your account does not have permission to view this page. If you
          believe this is in error, contact the Board administrator.
        </p>
        <Button asChild>
          <Link href="/admin">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
