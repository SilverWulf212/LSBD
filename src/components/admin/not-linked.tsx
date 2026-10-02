import { NOT_LINKED_TEXT } from "@/lib/staff-labels";

export function NotLinked({ detail }: { detail?: string }) {
  return (
    <span className="text-muted-foreground italic">
      {NOT_LINKED_TEXT}
      {detail ? ` ${detail}` : ""}
    </span>
  );
}
