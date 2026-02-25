import { hash } from "bcryptjs";
import { db } from "../src/lib/db";
import {
  users, boardMembers, fees, staffMembers, pageSections,
  alerts, posts, meetings, meetingDocuments, downloadableForms, publications,
  auditLog,
} from "../src/lib/db/schema";

async function seed() {
  console.log("Seeding database...");

  // Delete existing data in correct order (respect foreign keys)
  console.log("Clearing existing data...");
  await db.delete(auditLog);
  await db.delete(meetingDocuments);
  await db.delete(meetings);
  await db.delete(posts);
  await db.delete(pageSections);
  await db.delete(alerts);
  await db.delete(downloadableForms);
  await db.delete(publications);
  await db.delete(fees);
  await db.delete(staffMembers);
  await db.delete(boardMembers);
  await db.delete(users);
  console.log("✓ Existing data cleared");

  // 1. Admin user
  const password = process.env.INITIAL_ADMIN_PASSWORD || "changeme123";
  const passwordHash = await hash(password, 12);
  const [adminUser] = await db.insert(users).values({
    email: "erin@lsbd.org",
    passwordHash,
    name: "Erin Conner",
  }).returning({ id: users.id }).onConflictDoNothing();
  const adminUserId = adminUser?.id ?? 1;
  console.log("✓ Admin user created");

  // 2. Board members (from current site)
  const boardMemberData = [
    { name: "Kimberly Caldwell", honorific: "Dr.", role: "president" as const, district: "4th", sortOrder: 1 },
    { name: "David Baughman", honorific: "Dr.", role: "vice_president" as const, district: "2nd", sortOrder: 2 },
    { name: "Nelson Daly", honorific: "Dr.", role: "secretary_treasurer" as const, district: "8th", sortOrder: 3 },
    { name: "Donald Bennett", honorific: "Dr.", role: "member" as const, district: "5th", sortOrder: 4 },
    { name: "Terry Billings", honorific: "Dr.", role: "member" as const, district: "5th", sortOrder: 5 },
    { name: "Michael Casadaban", honorific: "Dr.", role: "member" as const, district: "8th", sortOrder: 6 },
    { name: "David Chambers", honorific: "Dr.", role: "member" as const, district: "1st", sortOrder: 7 },
    { name: "Stephen Chapman", honorific: "Dr.", role: "member" as const, district: "3rd", sortOrder: 8 },
    { name: "Adam Cormier", honorific: "Dr.", role: "member" as const, district: "7th", sortOrder: 9 },
    { name: "Griffin Deen", honorific: "Dr.", role: "member" as const, district: "6th", sortOrder: 10 },
    { name: "Jeetendra Patel", honorific: "Dr.", role: "member" as const, district: "4th", sortOrder: 11 },
    { name: "Thomas Price", honorific: "Dr.", role: "member" as const, district: "9th", sortOrder: 12 },
    { name: "Joshua Reaves", honorific: "Dr.", role: "member" as const, district: "1st", sortOrder: 13 },
    { name: "Joelle Breaux", credential: "R.D.H.", role: "hygienist_representative" as const, sortOrder: 14 },
    { name: "Carlos Zelaya", honorific: "Mr.", role: "consumer_member" as const, sortOrder: 15 },
  ];
  for (const member of boardMemberData) {
    await db.insert(boardMembers).values({ ...member, isActive: true }).onConflictDoNothing();
  }
  console.log("✓ Board members seeded");

  // 3. Fee schedule (from current site)
  const feeData = [
    // Dentist fees
    { category: "dentist" as const, name: "Licensure by Examination (LBE)", amount: 35000, sortOrder: 1 },
    { category: "dentist" as const, name: "Licensure by Credentials (LBC)", amount: 205000, sortOrder: 2 },
    { category: "dentist" as const, name: "Biennial License Renewal", amount: 59000, sortOrder: 3 },
    { category: "dentist" as const, name: "Personal Nitrous Oxide Permit", amount: 5000, sortOrder: 4 },
    { category: "dentist" as const, name: "Personal Nitrous Oxide Permit Renewal", amount: 5000, sortOrder: 5 },
    { category: "dentist" as const, name: "Moderate Sedation/General Anesthesia Permit", amount: 40000, sortOrder: 6 },
    { category: "dentist" as const, name: "Moderate Sedation/GA Permit Renewal", amount: 20000, sortOrder: 7 },
    // Hygienist fees
    { category: "hygienist" as const, name: "Licensure by Examination (LBE)", amount: 18000, sortOrder: 1 },
    { category: "hygienist" as const, name: "Licensure by Credentials (LBC)", amount: 83000, sortOrder: 2 },
    { category: "hygienist" as const, name: "Biennial License Renewal", amount: 23000, sortOrder: 3 },
    { category: "hygienist" as const, name: "Nitrous Oxide Permit", amount: 5000, sortOrder: 4 },
    { category: "hygienist" as const, name: "Local Anesthesia Permit", amount: 5000, sortOrder: 5 },
    // Miscellaneous
    { category: "miscellaneous" as const, name: "EDDA Certification Confirmation", amount: 10000, sortOrder: 1 },
    { category: "miscellaneous" as const, name: "Official List of All Dentists or Hygienists", amount: 50000, sortOrder: 2 },
    { category: "miscellaneous" as const, name: "Up to 1/2 of Official List", amount: 25000, sortOrder: 3 },
  ];
  for (const fee of feeData) {
    await db.insert(fees).values({ ...fee, isActive: true }).onConflictDoNothing();
  }
  console.log("✓ Fees seeded");

  // 4. Staff members (from current site)
  const staffData = [
    { name: "Arthur F. Hickham, Jr.", title: "Executive Director", email: "ahickham@lsbd.org", phone: "225-219-7330", sortOrder: 1 },
    { name: "Erin Conner", title: "Assistant Executive Director", email: "erin@lsbd.org", phone: "225-219-7330", sortOrder: 2 },
    { name: "Rachel Daniel", title: "Administrative Assistant", email: "rachel@lsbd.org", phone: "225-219-7330", sortOrder: 3 },
    { name: "Alexx Smith", title: "Inspector", email: "alexx@lsbd.org", phone: "225-219-7330", sortOrder: 4 },
    { name: "Iris Pourciau", title: "Administrative Coordinator \u2013 Licensing", email: "iris@lsbd.org", phone: "225-219-7330", sortOrder: 5 },
    { name: "Meg Isacks", title: "Administrative Coordinator \u2013 Front Desk", email: "meg@lsbd.org", phone: "225-219-7330", sortOrder: 6 },
  ];
  for (const staff of staffData) {
    await db.insert(staffMembers).values({ ...staff, isActive: true }).onConflictDoNothing();
  }
  console.log("✓ Staff members seeded");

  // 5. Initial page sections
  const sections = [
    { pageSlug: "home", sectionKey: "hero_content", title: "Welcome", content: "<p>Protect the public by regulating the professions of dentistry and dental hygiene in Louisiana in accordance with the Dental Practice Act.</p>" },
    { pageSlug: "home", sectionKey: "scam_alert", title: "Scam Warning", content: "<p><strong>WARNING:</strong> The Board has been alerted to individuals fraudulently claiming to be staff of the Board, claiming that the licensee is under investigation, and demanding payment. The Board will NEVER contact licensees demanding money without a formal investigation.</p>" },
    { pageSlug: "dentists", sectionKey: "overview", title: "Dentist Information", content: "<p>Information for Louisiana licensed dentists and dentist applicants.</p>" },
    { pageSlug: "hygienists", sectionKey: "overview", title: "Hygienist Information", content: "<p>Information for Louisiana licensed dental hygienists and hygienist applicants.</p>" },
    { pageSlug: "assistants", sectionKey: "overview", title: "Dental Assisting", content: "<p>Information regarding dental assisting duties, procedures, and expanded duty dental assistant (EDDA) requirements.</p>" },
  ];
  for (const section of sections) {
    await db.insert(pageSections).values(section).onConflictDoNothing();
  }
  console.log("✓ Page sections seeded");

  // 6. Alerts
  const alertData = [
    {
      title: "Biennial License Renewal Deadline",
      content: "All dental and dental hygiene licenses expire on December 31, 2026. Biennial renewal applications are available through the online portal. Late renewals are subject to additional fees.",
      severity: "warning" as const,
      isActive: true,
      startsAt: new Date("2026-01-01T00:00:00Z"),
      endsAt: new Date("2026-12-31T23:59:59Z"),
      sortOrder: 0,
    },
    {
      title: "Updated Opioid Management CE Requirements",
      content: "Effective January 1, 2026, all dentists must complete a one-time three (3) hour course on opioid management continuing education. See Resources for approved courses.",
      severity: "info" as const,
      isActive: true,
      startsAt: new Date("2026-01-01T00:00:00Z"),
      sortOrder: 1,
    },
  ];
  for (const alert of alertData) {
    await db.insert(alerts).values(alert).onConflictDoNothing();
  }
  console.log("✓ Alerts seeded");

  // 7. Posts (news articles)
  const postData = [
    {
      title: "Board Approves Revised Anesthesia Permit Requirements",
      slug: "revised-anesthesia-permit-requirements-2026",
      content: `<p>The Louisiana State Board of Dentistry has approved revised requirements for dental anesthesia permits, effective July 1, 2026. These changes reflect updated safety standards and align with recommendations from the American Dental Association.</p><h2>Key Changes</h2><ul><li>Minimum facility inspection requirements have been updated to include new emergency equipment standards</li><li>Continuing education requirements for permit holders have been increased to 8 hours annually</li><li>A new supervised clinical experience pathway has been established for initial permit applicants</li></ul><p>All current permit holders will receive written notification of the changes. The Board encourages practitioners to review the updated rules, available on the Laws &amp; Rules page.</p>`,
      excerpt: "The Board has approved updated anesthesia permit requirements effective July 1, 2026, including new facility standards and CE requirements.",
      status: "published" as const,
      publishedAt: new Date("2026-02-15T10:00:00Z"),
      authorId: adminUserId,
    },
    {
      title: "CE Broker Integration Now Available for Louisiana Licensees",
      slug: "ce-broker-integration-available",
      content: `<p>The Louisiana State Board of Dentistry is pleased to announce the integration of CE Broker for tracking continuing education credits. All Louisiana-licensed dentists and dental hygienists can now use CE Broker to manage and report their CE compliance electronically.</p><h2>Getting Started</h2><p>Visit <a href="https://cebroker.com">cebroker.com</a> to create your free account and link your Louisiana license. Your existing CE records will be automatically imported where available.</p><p>This integration streamlines the audit process and provides real-time compliance tracking for licensees.</p>`,
      excerpt: "CE Broker is now integrated with the Board for electronic CE tracking. Create your free account today.",
      status: "published" as const,
      publishedAt: new Date("2026-02-01T09:00:00Z"),
      authorId: adminUserId,
    },
    {
      title: "March 2026 Board Meeting Scheduled",
      slug: "march-2026-board-meeting",
      content: `<p>The next regular meeting of the Louisiana State Board of Dentistry will be held on Friday, March 20, 2026, beginning at 9:00 AM in the Board's offices at 18212 East Petroleum Drive, Suite 2-B, Baton Rouge, Louisiana 70809.</p><p>The agenda will be posted at least 24 hours in advance of the meeting in accordance with the Louisiana Open Meetings Law. Members of the public are welcome to attend.</p>`,
      excerpt: "The next Board meeting is scheduled for March 20, 2026, at 9:00 AM at the Board offices in Baton Rouge.",
      status: "published" as const,
      publishedAt: new Date("2026-01-20T08:00:00Z"),
      authorId: adminUserId,
    },
    {
      title: "Reminder: BLS Certification Required for All Licensees",
      slug: "bls-certification-reminder",
      content: `<p>The Louisiana State Board of Dentistry reminds all licensed dentists and dental hygienists that a current Basic Life Support (BLS) certification is required for active licensure. BLS certification must be from an approved provider and must remain current throughout the license period.</p><p>Failure to maintain current BLS certification may result in disciplinary action. Contact the Board office if you have questions about approved BLS providers.</p>`,
      excerpt: "All licensed dentists and hygienists must maintain current BLS certification for active licensure.",
      status: "published" as const,
      publishedAt: new Date("2026-01-10T08:00:00Z"),
      authorId: adminUserId,
    },
  ];
  for (const post of postData) {
    await db.insert(posts).values(post).onConflictDoNothing();
  }
  console.log("✓ Posts seeded");

  // 8. Meetings and meeting documents
  const meetingData = [
    {
      title: "Regular Board Meeting",
      meetingDate: new Date("2026-03-20T14:00:00Z"),
      description: "Regular meeting of the Louisiana State Board of Dentistry. Open to the public.",
      meetingType: "board",
      isPublished: true,
    },
    {
      title: "Disciplinary Oversight Committee Meeting",
      meetingDate: new Date("2026-04-10T14:00:00Z"),
      description: "Disciplinary Oversight Committee meeting to review pending cases.",
      meetingType: "disciplinary",
      isPublished: true,
    },
    {
      title: "Regular Board Meeting",
      meetingDate: new Date("2026-05-16T14:00:00Z"),
      description: "Regular meeting of the Louisiana State Board of Dentistry.",
      meetingType: "board",
      isPublished: true,
    },
    {
      title: "Regular Board Meeting - January 2026",
      meetingDate: new Date("2026-01-17T14:00:00Z"),
      description: "Regular January meeting of the Louisiana State Board of Dentistry.",
      meetingType: "board",
      isPublished: true,
    },
  ];

  const insertedMeetings: { id: number }[] = [];
  for (const meeting of meetingData) {
    const [inserted] = await db.insert(meetings).values(meeting).returning({ id: meetings.id }).onConflictDoNothing();
    insertedMeetings.push(inserted || { id: 0 });
  }
  console.log("✓ Meetings seeded");

  // Meeting documents (linked to inserted meeting IDs)
  const meetingId1 = insertedMeetings[0]?.id;
  const meetingId4 = insertedMeetings[3]?.id;

  if (meetingId1 && meetingId1 > 0) {
    await db.insert(meetingDocuments).values([
      {
        meetingId: meetingId1,
        docType: "notice" as const,
        title: "Public Notice - March 2026 Meeting",
        blobUrl: "#",
        blobPathname: "meetings/2026/march-notice.pdf",
        fileSizeBytes: 245000,
      },
      {
        meetingId: meetingId1,
        docType: "agenda" as const,
        title: "Agenda - March 2026 Meeting",
        blobUrl: "#",
        blobPathname: "meetings/2026/march-agenda.pdf",
        fileSizeBytes: 180000,
      },
    ]).onConflictDoNothing();
  }

  if (meetingId4 && meetingId4 > 0) {
    await db.insert(meetingDocuments).values([
      {
        meetingId: meetingId4,
        docType: "notice" as const,
        title: "Public Notice - January 2026",
        blobUrl: "#",
        blobPathname: "meetings/2026/jan-notice.pdf",
        fileSizeBytes: 198000,
      },
      {
        meetingId: meetingId4,
        docType: "agenda" as const,
        title: "Agenda - January 2026",
        blobUrl: "#",
        blobPathname: "meetings/2026/jan-agenda.pdf",
        fileSizeBytes: 215000,
      },
      {
        meetingId: meetingId4,
        docType: "minutes" as const,
        title: "Minutes - January 2026",
        blobUrl: "#",
        blobPathname: "meetings/2026/jan-minutes.pdf",
        fileSizeBytes: 340000,
      },
    ]).onConflictDoNothing();
  }
  console.log("✓ Meeting documents seeded");

  // 9. Downloadable forms
  const formData = [
    { name: "Change of Address/Name/Email Form", description: "Notify the Board of changes to your personal information", category: "change_of_info", blobUrl: "#", blobPathname: "forms/change-of-info.pdf", fileSizeBytes: 124000, isExternal: false, sortOrder: 0 },
    { name: "General Anesthesia Permit Application", description: "Application for initial general anesthesia permit", category: "dental_anesthesia", blobUrl: "#", blobPathname: "forms/ga-permit-app.pdf", fileSizeBytes: 356000, isExternal: false, sortOrder: 0 },
    { name: "Parenteral Conscious Sedation Permit Application", description: "Application for parenteral conscious sedation permit", category: "dental_anesthesia", blobUrl: "#", blobPathname: "forms/pcs-permit-app.pdf", fileSizeBytes: 312000, isExternal: false, sortOrder: 1 },
    { name: "Dental Hygiene Local Anesthesia Permit Application", description: "Application for dental hygienists to administer local anesthesia", category: "hygiene_anesthesia", blobUrl: "#", blobPathname: "forms/hygiene-la-permit.pdf", fileSizeBytes: 198000, isExternal: false, sortOrder: 0 },
    { name: "Dental Hygiene Nitrous Oxide Monitoring Permit", description: "Application for monitoring nitrous oxide analgesia", category: "hygiene_anesthesia", blobUrl: "#", blobPathname: "forms/hygiene-n2o-permit.pdf", fileSizeBytes: 187000, isExternal: false, sortOrder: 1 },
    { name: "Mobile Dental Facility Registration", description: "Registration for mobile or portable dental offices", category: "mobile_portable", blobUrl: "#", blobPathname: "forms/mobile-facility-reg.pdf", fileSizeBytes: 276000, isExternal: false, sortOrder: 0 },
    { name: "Opioid Management CE Exemption Request", description: "Request exemption from opioid management CE requirement (one-time requirement for dentists)", category: "opioid", blobUrl: "#", blobPathname: "forms/opioid-exemption.pdf", fileSizeBytes: 98000, isExternal: false, sortOrder: 0 },
    { name: "CDC Dental Office Inspection Checklist", description: "Self-inspection checklist based on CDC infection control guidelines", category: "cdc_inspection", blobUrl: "#", blobPathname: "forms/cdc-checklist.pdf", fileSizeBytes: 430000, isExternal: false, sortOrder: 0 },
    { name: "Controlled Substances Registration Application", description: "Application for DEA controlled substances registration", category: "controlled_substances", isExternal: true, externalUrl: "https://www.deadiversion.usdoj.gov/", sortOrder: 0 },
    { name: "EDDA Certification Application", description: "Application for Expanded Duty Dental Assistant certification", category: "additional", blobUrl: "#", blobPathname: "forms/edda-cert-app.pdf", fileSizeBytes: 234000, isExternal: false, sortOrder: 0 },
    { name: "Complaint Form", description: "File a complaint against a licensed dental professional", category: "miscellaneous", blobUrl: "#", blobPathname: "forms/complaint-form.pdf", fileSizeBytes: 156000, isExternal: false, sortOrder: 0 },
  ];
  for (const form of formData) {
    await db.insert(downloadableForms).values({ ...form, isActive: true }).onConflictDoNothing();
  }
  console.log("✓ Downloadable forms seeded");

  // 10. Publications
  const publicationData = [
    { title: "The Bulletin - Winter 2026", year: 2026, description: "Winter 2026 edition of The Bulletin, the official newsletter of the Louisiana State Board of Dentistry.", blobUrl: "#", blobPathname: "publications/bulletin-winter-2026.pdf", fileSizeBytes: 2100000, isPublished: true },
    { title: "The Bulletin - Fall 2025", year: 2025, description: "Fall 2025 edition featuring updated CE requirements and Board meeting summaries.", blobUrl: "#", blobPathname: "publications/bulletin-fall-2025.pdf", fileSizeBytes: 1890000, isPublished: true },
    { title: "The Bulletin - Summer 2025", year: 2025, description: "Summer 2025 edition with anesthesia permit updates and disciplinary actions.", blobUrl: "#", blobPathname: "publications/bulletin-summer-2025.pdf", fileSizeBytes: 1760000, isPublished: true },
    { title: "The Bulletin - Spring 2025", year: 2025, description: "Spring 2025 edition covering renewal reminders and legislative updates.", blobUrl: "#", blobPathname: "publications/bulletin-spring-2025.pdf", fileSizeBytes: 1650000, isPublished: true },
  ];
  for (const pub of publicationData) {
    await db.insert(publications).values(pub).onConflictDoNothing();
  }
  console.log("✓ Publications seeded");

  console.log("\nSeeding complete!");
}

seed().catch(console.error);
