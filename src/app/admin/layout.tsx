import React from "react";
import { auth } from "@/lib/auth";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminHeader } from "@/components/admin/admin-header";
import { ReadonlyBanner } from "@/components/admin/readonly-banner";
import { Toaster } from "sonner";

export const metadata = {
  title: "Admin | Louisiana State Board of Dentistry",
  description: "LSBD Administration Dashboard",
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // If not authenticated, render children directly (login page)
  if (!session?.user) {
    return (
      <>
        {children}
        <Toaster position="top-right" richColors />
      </>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-muted/30 print:block print:h-auto print:overflow-visible print:bg-white">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-border lg:bg-background print:hidden">
        <AdminSidebar userRole={session.user.role} />
      </aside>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden print:block print:overflow-visible">
        <div className="print:hidden">
          <AdminHeader
            userName={session.user.name}
            userEmail={session.user.email}
            userRole={session.user.role}
          />
        </div>
        <ReadonlyBanner />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 print:overflow-visible print:p-0">
          {children}
        </main>
      </div>

      <Toaster position="top-right" richColors />
    </div>
  );
}
