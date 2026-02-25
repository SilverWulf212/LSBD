import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { MeetingList } from "@/components/content/meeting-list";
import { db } from "@/lib/db";
import { CONTACT } from "@/lib/constants";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Meetings & Minutes",
  description: "Board meeting schedule, agendas, public notices, and approved minutes.",
};

export default async function MeetingsPage() {
  const allMeetings = await db.query.meetings.findMany({
    where: (meetings, { eq }) => eq(meetings.isPublished, true),
    orderBy: (meetings, { desc }) => [desc(meetings.meetingDate)],
    with: { documents: true },
  });

  const now = new Date();
  const upcoming = allMeetings.filter((m) => new Date(m.meetingDate) >= now);
  const past = allMeetings.filter((m) => new Date(m.meetingDate) < now);

  return (
    <>
      <PageHeader title="Meetings & Minutes" description="View upcoming Board meetings, download agendas and public notices, and access approved minutes from past meetings." />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-10">
        <section>
          <h2 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-[#005f8f] uppercase tracking-wide mb-6">Upcoming Meetings</h2>
          <MeetingList meetings={upcoming} />
        </section>
        {past.length > 0 && (
          <section>
            <h2 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-[#005f8f] uppercase tracking-wide mb-6">Past Meetings</h2>
            <MeetingList meetings={past} />
          </section>
        )}
        <div className="bg-[#CAF0F8]/30 rounded-xl p-6 text-sm text-[#495057] space-y-2">
          <p><strong>Meeting Location:</strong> Unless otherwise noted, meetings are held at the Board offices at {CONTACT.physicalAddress}.</p>
          <p><strong>Open Meetings Law:</strong> All meetings of the Board are conducted in compliance with the Louisiana Open Meetings Law (R.S. 42:11-28). Agendas are posted at least 24 hours before each meeting.</p>
          <p><strong>Public Attendance:</strong> Members of the public are welcome to attend all open sessions of Board meetings.</p>
        </div>
      </div>
    </>
  );
}
