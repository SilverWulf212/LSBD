import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface BoardMemberCardProps {
  name: string;
  honorific?: string | null;
  credential?: string | null;
  role: string;
  district?: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  president: "President",
  vice_president: "Vice President",
  secretary_treasurer: "Secretary-Treasurer",
  member: "Member",
  hygienist_representative: "Hygienist Representative",
  consumer_member: "Consumer Member",
};

export function BoardMemberCard({
  name,
  honorific,
  credential,
  role,
  district,
}: BoardMemberCardProps) {
  const displayName = [honorific, name].filter(Boolean).join(" ");
  const fullName = credential ? `${displayName}, ${credential}` : displayName;
  const roleLabel = ROLE_LABELS[role] || role;

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="font-[family-name:var(--font-oswald)] text-base sm:text-lg text-[#005f8f] uppercase tracking-wide break-words">
            {fullName}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          <Badge
            variant="secondary"
            className="bg-[#CAF0F8] text-[#005f8f] border-0"
          >
            {roleLabel}
          </Badge>
          {district && (
            <p className="text-sm text-[#495057]">District: {district}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
