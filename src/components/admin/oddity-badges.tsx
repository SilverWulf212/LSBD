import { Badge } from "@/components/ui/badge";
import { ODDITY_LABELS, type LicenceOddity } from "@/lib/staff-oddities";

export function OddityBadges({ oddities }: { oddities: LicenceOddity[] }) {
  if (oddities.length === 0) return null;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {oddities.map((o) => (
        <Badge key={o} variant="outline" className="border-amber-400 bg-amber-50 text-amber-900">
          {ODDITY_LABELS[o]}
        </Badge>
      ))}
    </span>
  );
}
