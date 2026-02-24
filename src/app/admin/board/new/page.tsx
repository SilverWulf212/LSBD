import React from "react";
import Link from "next/link";
import { BoardMemberForm } from "@/components/admin/board-member-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "New Board Member | Admin" };

export default function NewBoardMemberPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild aria-label="Back to board">
          <Link href="/admin/board">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">New Board Member</h1>
          <p className="text-sm text-muted-foreground">Add a new board member</p>
        </div>
      </div>
      <BoardMemberForm />
    </div>
  );
}
