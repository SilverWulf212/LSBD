import {
  pgTable, text, varchar, integer, boolean, timestamp, serial, pgEnum, jsonb, index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const postStatusEnum = pgEnum("post_status", ["draft", "published", "archived"]);
export const alertSeverityEnum = pgEnum("alert_severity", ["info", "warning", "critical"]);
export const feeCategoryEnum = pgEnum("fee_category", ["dentist", "hygienist", "miscellaneous"]);
export const meetingDocTypeEnum = pgEnum("meeting_doc_type", ["notice", "agenda", "minutes"]);
export const boardRoleEnum = pgEnum("board_role", [
  "president", "vice_president", "secretary_treasurer", "member",
  "hygienist_representative", "consumer_member",
]);

// Users (admin)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Blog Posts
export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 500 }).notNull(),
  slug: varchar("slug", { length: 500 }).notNull().unique(),
  content: text("content").notNull(),
  excerpt: text("excerpt"),
  featuredImage: text("featured_image"),
  status: postStatusEnum("status").default("draft").notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  authorId: integer("author_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("posts_slug_idx").on(table.slug),
  index("posts_status_idx").on(table.status),
  index("posts_published_at_idx").on(table.publishedAt),
]);

// Alerts
export const alerts = pgTable("alerts", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 500 }).notNull(),
  content: text("content").notNull(),
  severity: alertSeverityEnum("severity").default("info").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Board Members
export const boardMembers = pgTable("board_members", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  honorific: varchar("honorific", { length: 50 }),
  credential: varchar("credential", { length: 100 }),
  role: boardRoleEnum("role").default("member").notNull(),
  district: varchar("district", { length: 50 }),
  imageUrl: text("image_url"),
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Fees
export const fees = pgTable("fees", {
  id: serial("id").primaryKey(),
  category: feeCategoryEnum("category").notNull(),
  name: varchar("name", { length: 500 }).notNull(),
  amount: integer("amount").notNull(), // cents
  description: text("description"),
  sortOrder: integer("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("fees_category_idx").on(table.category),
]);

// Meetings
export const meetings = pgTable("meetings", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 500 }).notNull(),
  meetingDate: timestamp("meeting_date", { withTimezone: true }).notNull(),
  description: text("description"),
  meetingType: varchar("meeting_type", { length: 100 }).default("board").notNull(),
  isPublished: boolean("is_published").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("meetings_date_idx").on(table.meetingDate),
]);

// Meeting Documents
export const meetingDocuments = pgTable("meeting_documents", {
  id: serial("id").primaryKey(),
  meetingId: integer("meeting_id").references(() => meetings.id, { onDelete: "cascade" }).notNull(),
  docType: meetingDocTypeEnum("doc_type").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  blobUrl: text("blob_url").notNull(),
  blobPathname: text("blob_pathname").notNull(),
  fileSizeBytes: integer("file_size_bytes"),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("meeting_docs_meeting_id_idx").on(table.meetingId),
]);

// Relations
export const meetingsRelations = relations(meetings, ({ many }) => ({
  documents: many(meetingDocuments),
}));

export const meetingDocumentsRelations = relations(meetingDocuments, ({ one }) => ({
  meeting: one(meetings, {
    fields: [meetingDocuments.meetingId],
    references: [meetings.id],
  }),
}));

// Downloadable Forms
export const downloadableForms = pgTable("downloadable_forms", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 500 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 200 }).notNull(),
  blobUrl: text("blob_url"),
  blobPathname: text("blob_pathname"),
  fileSizeBytes: integer("file_size_bytes"),
  isExternal: boolean("is_external").default(false).notNull(),
  externalUrl: text("external_url"),
  sortOrder: integer("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Publications
export const publications = pgTable("publications", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 500 }).notNull(),
  year: integer("year").notNull(),
  description: text("description"),
  blobUrl: text("blob_url").notNull(),
  blobPathname: text("blob_pathname").notNull(),
  fileSizeBytes: integer("file_size_bytes"),
  isPublished: boolean("is_published").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Staff Members
export const staffMembers = pgTable("staff_members", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  responsibilities: text("responsibilities"),
  phone: varchar("phone", { length: 50 }),
  sortOrder: integer("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Editable Page Sections
export const pageSections = pgTable("page_sections", {
  id: serial("id").primaryKey(),
  pageSlug: varchar("page_slug", { length: 200 }).notNull(),
  sectionKey: varchar("section_key", { length: 200 }).notNull(),
  title: varchar("title", { length: 500 }),
  content: text("content").notNull(),
  metadata: jsonb("metadata"),
  sortOrder: integer("sort_order").default(0).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: integer("updated_by").references(() => users.id),
}, (table) => [
  index("page_sections_page_slug_idx").on(table.pageSlug),
  index("page_sections_compound_idx").on(table.pageSlug, table.sectionKey),
]);

// Audit Log
export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  action: varchar("action", { length: 50 }).notNull(),
  entityType: varchar("entity_type", { length: 100 }).notNull(),
  entityId: integer("entity_id"),
  details: jsonb("details"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("audit_log_entity_idx").on(table.entityType, table.entityId),
  index("audit_log_created_at_idx").on(table.createdAt),
]);
