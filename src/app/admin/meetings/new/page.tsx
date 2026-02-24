import React from "react";
import Link from "next/link";
import { MeetingForm } from "@/components/admin/meeting-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "New Meeting | Admin" };

export default function NewMeetingPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild aria-label="Back to meetings">
          <Link href="/admin/meetings">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">New Meeting</h1>
          <p className="text-sm text-muted-foreground">Schedule a new meeting</p>
        </div>
      </div>
      <MeetingForm />
    </div>
  );
}
