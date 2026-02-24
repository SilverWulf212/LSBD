import React from "react";
import Link from "next/link";
import { getBoardMembers } from "@/actions/board-members";
import { BoardTable } from "./board-table";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export const metadata = { title: "Board Members | Admin" };

export default async function BoardPage() {
  const members = await getBoardMembers();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Board Members</h1>
          <p className="text-sm text-muted-foreground">
            Manage board member listings
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/board/new">
            <Plus className="h-4 w-4" aria-hidden="true" />
            New Member
          </Link>
        </Button>
      </div>
      <BoardTable members={members} />
    </div>
  );
}
