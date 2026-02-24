import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBoardMember } from "@/actions/board-members";
import { BoardMemberForm } from "@/components/admin/board-member-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "Edit Board Member | Admin" };

export default async function EditBoardMemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const member = await getBoardMember(Number(id));
  if (!member) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild aria-label="Back to board">
          <Link href="/admin/board">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">Edit Board Member</h1>
          <p className="text-sm text-muted-foreground">{member.name}</p>
        </div>
      </div>
      <BoardMemberForm boardMember={member} />
    </div>
  );
}
