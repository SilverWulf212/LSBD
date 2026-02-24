import { z } from "zod";

export const postSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  slug: z.string().min(1).max(500).regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, and hyphens only"),
  content: z.string().min(1, "Content is required"),
  excerpt: z.string().max(500).optional(),
  featuredImage: z.string().url().optional().or(z.literal("")),
  status: z.enum(["draft", "published", "archived"]),
});

export const alertSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  content: z.string().min(1, "Content is required"),
  severity: z.enum(["info", "warning", "critical"]),
  isActive: z.boolean(),
  startsAt: z.string().datetime().optional().or(z.literal("")),
  endsAt: z.string().datetime().optional().or(z.literal("")),
  sortOrder: z.coerce.number().int().min(0),
});

export const boardMemberSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  honorific: z.string().max(50).optional().or(z.literal("")),
  credential: z.string().max(100).optional().or(z.literal("")),
  role: z.enum(["president", "vice_president", "secretary_treasurer", "member", "hygienist_representative", "consumer_member"]),
  district: z.string().max(50).optional().or(z.literal("")),
  imageUrl: z.string().url().optional().or(z.literal("")),
  isActive: z.boolean(),
  sortOrder: z.coerce.number().int().min(0),
});

export const feeSchema = z.object({
  category: z.enum(["dentist", "hygienist", "miscellaneous"]),
  name: z.string().min(1, "Fee name is required").max(500),
  amount: z.coerce.number().int().min(0, "Amount must be positive"),
  description: z.string().max(1000).optional().or(z.literal("")),
  sortOrder: z.coerce.number().int().min(0),
  isActive: z.boolean(),
});

export const meetingSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  meetingDate: z.string().min(1, "Date is required"),
  description: z.string().max(2000).optional().or(z.literal("")),
  meetingType: z.enum(["board", "disciplinary", "office_management", "nominating", "act454"]),
  isPublished: z.boolean(),
});

export const staffSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  title: z.string().min(1, "Title is required").max(255),
  email: z.string().email("Must be a valid email").max(255),
  responsibilities: z.string().max(1000).optional().or(z.literal("")),
  phone: z.string().max(50).optional().or(z.literal("")),
  sortOrder: z.coerce.number().int().min(0),
  isActive: z.boolean(),
});

export const pageSectionSchema = z.object({
  pageSlug: z.string().min(1).max(200),
  sectionKey: z.string().min(1).max(200),
  title: z.string().max(500).optional().or(z.literal("")),
  content: z.string().min(1, "Content is required"),
});

export const formEntrySchema = z.object({
  name: z.string().min(1, "Name is required").max(500),
  description: z.string().max(1000).optional().or(z.literal("")),
  category: z.string().min(1, "Category is required").max(200),
  isExternal: z.boolean(),
  externalUrl: z.string().url().optional().or(z.literal("")),
  sortOrder: z.coerce.number().int().min(0),
  isActive: z.boolean(),
});

export const publicationSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  year: z.coerce.number().int().min(1894).max(2100),
  description: z.string().max(1000).optional().or(z.literal("")),
  isPublished: z.boolean(),
});
