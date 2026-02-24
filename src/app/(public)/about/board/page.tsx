import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { BoardMemberCard } from "@/components/content/board-member-card";
import { MOCK_BOARD_MEMBERS } from "@/lib/mock-data";

export const metadata: Metadata = {
  title: "Board Members",
  description: "Meet the members of the Louisiana State Board of Dentistry.",
};

export default function BoardMembersPage() {
  const sorted = [...MOCK_BOARD_MEMBERS].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <>
      <PageHeader title="Board Members" description="The Board is composed of eight members appointed by the Governor to oversee dental regulation in Louisiana." />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {sorted.map((member) => (
            <BoardMemberCard
              key={member.id}
              name={member.name}
              honorific={member.honorific}
              credential={member.credential}
              role={member.role}
              district={member.district}
            />
          ))}
        </div>
        <div className="mt-10 bg-[#CAF0F8]/30 rounded-xl p-6 text-sm text-[#495057] space-y-2">
          <p><strong>Board Composition:</strong> Six licensed dentists (one from each dental district), one licensed dental hygienist, and one consumer member.</p>
          <p><strong>Appointment:</strong> Board members are appointed by the Governor from nominations submitted by the Louisiana Dental Association.</p>
          <p><strong>Terms:</strong> Board members serve six-year staggered terms.</p>
        </div>
      </div>
    </>
  );
}
