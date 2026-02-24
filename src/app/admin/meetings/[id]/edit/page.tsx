import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMeeting } from "@/actions/meetings";
import { MeetingForm } from "@/components/admin/meeting-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "Edit Meeting | Admin" };

export default async function EditMeetingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const meeting = await getMeeting(Number(id));
  if (!meeting) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild aria-label="Back to meetings">
          <Link href="/admin/meetings">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">Edit Meeting</h1>
          <p className="text-sm text-muted-foreground">{meeting.title}</p>
        </div>
      </div>
      <MeetingForm meeting={meeting} />
    </div>
  );
}
