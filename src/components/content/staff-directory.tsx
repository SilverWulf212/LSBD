import { Mail, Phone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface StaffMember {
  id: number;
  name: string;
  title: string;
  email: string;
  phone?: string | null;
  responsibilities?: string | null;
}

export function StaffDirectory({ staff }: { staff: StaffMember[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {staff.map((member) => (
        <Card key={member.id} className="h-full">
          <CardHeader>
            <CardTitle className="font-[family-name:var(--font-oswald)] text-base sm:text-lg text-[#005f8f] uppercase tracking-wide break-words">
              {member.name}
            </CardTitle>
            <p className="text-sm font-medium text-[#495057]">{member.title}</p>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {member.responsibilities && (
              <p className="text-sm text-gray-500">{member.responsibilities}</p>
            )}
            <div className="flex flex-col gap-1.5">
              <a
                href={`mailto:${member.email}`}
                className="inline-flex items-center gap-2 text-sm text-[#005f8f] hover:text-[#003f5f] transition-colors focus-visible:ring-2 focus-visible:ring-[#0077B6] focus-visible:ring-offset-2 focus-visible:outline-none rounded break-all"
              >
                <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
                {member.email}
              </a>
              {member.phone && (
                <a
                  href={`tel:${member.phone.replace(/[^0-9+]/g, "")}`}
                  className="inline-flex items-center gap-2 text-sm text-[#005f8f] hover:text-[#003f5f] transition-colors focus-visible:ring-2 focus-visible:ring-[#0077B6] focus-visible:ring-offset-2 focus-visible:outline-none rounded"
                >
                  <Phone className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {member.phone}
                </a>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
