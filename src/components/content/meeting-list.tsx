import { Calendar, FileText } from "lucide-react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PdfLink } from "@/components/shared/pdf-link";

interface MeetingDocument {
  id: number;
  docType: "notice" | "agenda" | "minutes";
  title: string;
  blobUrl: string;
  fileSizeBytes?: number | null;
}

interface Meeting {
  id: number;
  title: string;
  meetingDate: string | Date;
  description?: string | null;
  meetingType: string;
  documents?: MeetingDocument[];
}

const TYPE_LABELS: Record<string, string> = {
  board: "Board Meeting",
  disciplinary: "Disciplinary Oversight",
  office_management: "Office Management",
  nominating: "Nominating Committee",
  act454: "Act 454",
};

const DOC_TYPE_LABELS: Record<string, string> = {
  notice: "Public Notice",
  agenda: "Agenda",
  minutes: "Minutes",
};

export function MeetingList({ meetings }: { meetings: Meeting[] }) {
  if (meetings.length === 0) {
    return (
      <p className="text-sm text-gray-500 py-4">
        No meetings scheduled at this time.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {meetings.map((meeting) => {
        const date = new Date(meeting.meetingDate);
        return (
          <Card key={meeting.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-[#CAF0F8] p-2 shrink-0">
                    <Calendar
                      className="h-5 w-5 text-[#0077B6]"
                      aria-hidden="true"
                    />
                  </div>
                  <div>
                    <CardTitle className="font-[family-name:var(--font-oswald)] text-base text-[#005f8f] uppercase tracking-wide">
                      {meeting.title}
                    </CardTitle>
                    <p className="text-sm text-[#495057]">
                      <time dateTime={date.toISOString()}>
                        {format(date, "EEEE, MMMM d, yyyy")}
                      </time>
                    </p>
                  </div>
                </div>
                <Badge
                  variant="secondary"
                  className="bg-[#CAF0F8] text-[#005f8f] border-0 text-xs"
                >
                  {TYPE_LABELS[meeting.meetingType] || meeting.meetingType}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {meeting.description && (
                <p className="text-sm text-[#495057] mb-3">
                  {meeting.description}
                </p>
              )}
              {meeting.documents && meeting.documents.length > 0 && (
                <div className="flex flex-wrap gap-3">
                  {meeting.documents.map((doc) => (
                    <PdfLink
                      key={doc.id}
                      href={doc.blobUrl}
                      fileSize={doc.fileSizeBytes || undefined}
                      className="text-sm"
                    >
                      {DOC_TYPE_LABELS[doc.docType] || doc.title}
                    </PdfLink>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
