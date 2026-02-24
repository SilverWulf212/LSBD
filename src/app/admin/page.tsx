import React from "react";
import Link from "next/link";
import { getPostsCount } from "@/actions/posts";
import { getActiveAlertsCount } from "@/actions/alerts";
import { getBoardMembersCount } from "@/actions/board-members";
import { getUpcomingMeetingsCount } from "@/actions/meetings";
import { getRecentAuditLog } from "@/actions/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  AlertTriangle,
  Users,
  Calendar,
  Plus,
  Upload,
  Clock,
} from "lucide-react";

export const metadata = {
  title: "Dashboard | Admin",
};

const actionLabels: Record<string, string> = {
  create: "Created",
  update: "Updated",
  delete: "Deleted",
};

const entityLabels: Record<string, string> = {
  post: "Post",
  alert: "Alert",
  board_member: "Board Member",
  fee: "Fee",
  meeting: "Meeting",
  meeting_document: "Meeting Document",
  form: "Form",
  publication: "Publication",
  staff: "Staff Member",
  page_section: "Page Section",
};

export default async function AdminDashboard() {
  const [postsCount, alertsCount, boardCount, meetingsCount, auditLog] =
    await Promise.all([
      getPostsCount(),
      getActiveAlertsCount(),
      getBoardMembersCount(),
      getUpcomingMeetingsCount(),
      getRecentAuditLog(),
    ]);

  const stats = [
    {
      label: "Published Posts",
      value: postsCount,
      icon: FileText,
      href: "/admin/posts",
    },
    {
      label: "Active Alerts",
      value: alertsCount,
      icon: AlertTriangle,
      href: "/admin/alerts",
    },
    {
      label: "Board Members",
      value: boardCount,
      icon: Users,
      href: "/admin/board",
    },
    {
      label: "Upcoming Meetings",
      value: meetingsCount,
      icon: Calendar,
      href: "/admin/meetings",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Louisiana State Board of Dentistry admin overview
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link key={stat.label} href={stat.href}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.label}
                  </CardTitle>
                  <Icon
                    className="h-4 w-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold tabular-nums">
                    {stat.value}
                  </p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button asChild variant="outline" className="w-full justify-start">
              <Link href="/admin/posts/new">
                <Plus className="h-4 w-4" aria-hidden="true" />
                New Post
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start">
              <Link href="/admin/alerts/new">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                New Alert
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start">
              <Link href="/admin/meetings/new">
                <Upload className="h-4 w-4" aria-hidden="true" />
                New Meeting
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {auditLog.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Clock
                  className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2"
                  aria-hidden="true"
                />
                <p>No recent activity.</p>
                <p className="text-xs mt-1">
                  Activity will appear here once you start managing content.
                </p>
              </div>
            ) : (
              <ul className="space-y-3" role="list">
                {auditLog.map((entry) => {
                  const details = entry.details as Record<string, unknown> | null;
                  const entityName =
                    details?.title ?? details?.name ?? `#${entry.entityId}`;

                  return (
                    <li
                      key={entry.id}
                      className="flex items-start gap-3 text-sm"
                    >
                      <div className="mt-0.5 h-2 w-2 rounded-full bg-primary shrink-0" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p>
                          <span className="font-medium">
                            {entry.userName ?? "Unknown"}
                          </span>{" "}
                          <Badge variant="secondary" className="text-xs mx-1">
                            {actionLabels[entry.action] ?? entry.action}
                          </Badge>{" "}
                          <span className="text-muted-foreground">
                            {entityLabels[entry.entityType] ?? entry.entityType}
                          </span>
                          {entityName && (
                            <>
                              {" "}
                              <span className="font-medium">
                                {String(entityName)}
                              </span>
                            </>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(entry.createdAt).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
