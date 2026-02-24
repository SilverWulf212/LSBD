import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type {
  users, posts, alerts, boardMembers, fees, meetings,
  meetingDocuments, downloadableForms, publications, staffMembers,
  pageSections, auditLog,
} from "@/lib/db/schema";

// Select types (reading from DB)
export type User = InferSelectModel<typeof users>;
export type Post = InferSelectModel<typeof posts>;
export type Alert = InferSelectModel<typeof alerts>;
export type BoardMember = InferSelectModel<typeof boardMembers>;
export type Fee = InferSelectModel<typeof fees>;
export type Meeting = InferSelectModel<typeof meetings>;
export type MeetingDocument = InferSelectModel<typeof meetingDocuments>;
export type DownloadableForm = InferSelectModel<typeof downloadableForms>;
export type Publication = InferSelectModel<typeof publications>;
export type StaffMember = InferSelectModel<typeof staffMembers>;
export type PageSection = InferSelectModel<typeof pageSections>;
export type AuditLogEntry = InferSelectModel<typeof auditLog>;

// Insert types (writing to DB)
export type NewUser = InferInsertModel<typeof users>;
export type NewPost = InferInsertModel<typeof posts>;
export type NewAlert = InferInsertModel<typeof alerts>;
export type NewBoardMember = InferInsertModel<typeof boardMembers>;
export type NewFee = InferInsertModel<typeof fees>;
export type NewMeeting = InferInsertModel<typeof meetings>;
export type NewMeetingDocument = InferInsertModel<typeof meetingDocuments>;
export type NewDownloadableForm = InferInsertModel<typeof downloadableForms>;
export type NewPublication = InferInsertModel<typeof publications>;
export type NewStaffMember = InferInsertModel<typeof staffMembers>;
export type NewPageSection = InferInsertModel<typeof pageSections>;

// Meeting with documents joined
export type MeetingWithDocuments = Meeting & {
  documents: MeetingDocument[];
};
