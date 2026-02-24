import React from "react";
import Link from "next/link";
import { getMeetings } from "@/actions/meetings";
import { MeetingsTable } from "./meetings-table";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export const metadata = { title: "Meetings | Admin" };

export default async function MeetingsPage() {
  const meetings = await getMeetings();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Meetings</h1>
          <p className="text-sm text-muted-foreground">
            Manage meetings and upload documents
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/meetings/new">
            <Plus className="h-4 w-4" aria-hidden="true" />
            New Meeting
          </Link>
        </Button>
      </div>
      <MeetingsTable meetings={meetings} />
    </div>
  );
}
