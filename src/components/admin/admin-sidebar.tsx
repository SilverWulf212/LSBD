"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileText,
  AlertTriangle,
  Users,
  DollarSign,
  Calendar,
  ClipboardList,
  BookOpen,
  UserCog,
  Layers,
  Shield,
} from "lucide-react";
import type { LsbdRole } from "@/lib/auth-roles";

type SidebarItem = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
};

const sidebarItems: SidebarItem[] = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Posts", href: "/admin/posts", icon: FileText },
  { label: "Alerts", href: "/admin/alerts", icon: AlertTriangle },
  { label: "Board Members", href: "/admin/board", icon: Users },
  { label: "Fees", href: "/admin/fees", icon: DollarSign },
  { label: "Meetings", href: "/admin/meetings", icon: Calendar },
  { label: "Forms", href: "/admin/forms", icon: ClipboardList },
  { label: "Publications", href: "/admin/publications", icon: BookOpen },
  { label: "Staff", href: "/admin/staff", icon: UserCog },
  { label: "Page Content", href: "/admin/pages", icon: Layers },
  { label: "Users", href: "/admin/users", icon: Shield, adminOnly: true },
];

interface AdminSidebarProps {
  onNavigate?: () => void;
  userRole?: LsbdRole;
}

export function AdminSidebar({ onNavigate, userRole }: AdminSidebarProps) {
  const visibleItems = sidebarItems.filter(
    (item) => !item.adminOnly || userRole === "admin"
  );
  const pathname = usePathname();

  function isActive(href: string): boolean {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  }

  return (
    <nav aria-label="Admin navigation" className="flex flex-col h-full">
      <div className="px-4 py-5 border-b border-border">
        <Link
          href="/admin"
          className="flex items-center gap-2 text-lg font-semibold text-foreground"
          onClick={onNavigate}
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary text-primary-foreground text-sm font-bold">
            LS
          </div>
          <span>LSBD Admin</span>
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="flex flex-col gap-1" role="list">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    active
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-muted-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="border-t border-border px-4 py-3">
        <p className="text-xs text-muted-foreground">
          Louisiana State Board of Dentistry
        </p>
      </div>
    </nav>
  );
}
