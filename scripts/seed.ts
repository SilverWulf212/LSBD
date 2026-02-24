import { hash } from "bcryptjs";
import { db } from "../src/lib/db";
import {
  users, boardMembers, fees, staffMembers, pageSections,
} from "../src/lib/db/schema";

async function seed() {
  console.log("Seeding database...");

  // 1. Admin user
  const password = process.env.INITIAL_ADMIN_PASSWORD || "changeme123";
  const passwordHash = await hash(password, 12);
  await db.insert(users).values({
    email: "erin@lsbd.org",
    passwordHash,
    name: "Erin Connor",
  }).onConflictDoNothing();
  console.log("✓ Admin user created");

  // 2. Board members (from current site)
  const boardMemberData = [
    { name: "Dr. Marija Hedano LaBorde", honorific: "Dr.", role: "president" as const, district: "7th", sortOrder: 1 },
    { name: "Dr. Russell Gaudet", honorific: "Dr.", role: "vice_president" as const, district: "3rd", sortOrder: 2 },
    { name: "Dr. David Carlton", honorific: "Dr.", role: "secretary_treasurer" as const, district: "5th", sortOrder: 3 },
    { name: "Dr. Clayton Coffey", honorific: "Dr.", role: "member" as const, district: "1st", sortOrder: 4 },
    { name: "Dr. Joseph Simone III", honorific: "Dr.", role: "member" as const, district: "2nd", sortOrder: 5 },
    { name: "Dr. Troy Baughman", honorific: "Dr.", role: "member" as const, district: "4th", sortOrder: 6 },
    { name: "Dr. Brian LeBlanc", honorific: "Dr.", role: "member" as const, district: "6th", sortOrder: 7 },
    { name: "Dr. Trey Carlton", honorific: "Dr.", role: "member" as const, district: "8th", sortOrder: 8 },
    { name: "Dr. Courtney Klibert Cortez", honorific: "Dr.", role: "member" as const, district: "9th", sortOrder: 9 },
    { name: "Ms. Victoria Usry, R.D.H.", credential: "R.D.H.", role: "hygienist_representative" as const, sortOrder: 10 },
    { name: "Mr. Nick Muscarello", role: "consumer_member" as const, sortOrder: 11 },
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
    { category: "dentist" as const, name: "Louisiana Resident LBC", amount: 205000, sortOrder: 3 },
    { category: "dentist" as const, name: "Annual Renewal", amount: 27500, sortOrder: 4 },
    { category: "dentist" as const, name: "Late Renewal Penalty", amount: 15000, sortOrder: 5 },
    // Hygienist fees
    { category: "hygienist" as const, name: "Licensure by Examination (LBE)", amount: 18000, sortOrder: 1 },
    { category: "hygienist" as const, name: "Licensure by Credentials (LBC)", amount: 83000, sortOrder: 2 },
    { category: "hygienist" as const, name: "Louisiana Resident LBC", amount: 83000, sortOrder: 3 },
    { category: "hygienist" as const, name: "Annual Renewal", amount: 15000, sortOrder: 4 },
    { category: "hygienist" as const, name: "Late Renewal Penalty", amount: 10000, sortOrder: 5 },
    // Miscellaneous
    { category: "miscellaneous" as const, name: "Duplicate License", amount: 5000, sortOrder: 1 },
    { category: "miscellaneous" as const, name: "License Verification (to another state)", amount: 2500, sortOrder: 2 },
    { category: "miscellaneous" as const, name: "Anesthesia Permit Application", amount: 25000, sortOrder: 3 },
  ];
  for (const fee of feeData) {
    await db.insert(fees).values({ ...fee, isActive: true }).onConflictDoNothing();
  }
  console.log("✓ Fees seeded");

  // 4. Staff members (from current site)
  const staffData = [
    { name: "Arthur B. Hickham, Jr., D.D.S.", title: "Executive Director", email: "art@lsbd.org", phone: "225-219-7330", sortOrder: 1 },
    { name: "Erin Connor", title: "Assistant Executive Director", email: "erin@lsbd.org", phone: "225-219-7330", sortOrder: 2 },
    { name: "Ashleigh Daniel", title: "Administrative Assistant", email: "ashleigh@lsbd.org", phone: "225-219-7330", sortOrder: 3 },
    { name: "Breanna Isacks", title: "Administrative Assistant", email: "breanna@lsbd.org", phone: "225-219-7330", sortOrder: 4 },
    { name: "Charlotte Pourciau", title: "Investigator", email: "charlotte@lsbd.org", phone: "225-219-7330", sortOrder: 5 },
    { name: "Frances Smith, R.D.H.", title: "Continuing Education Coordinator", email: "frances@lsbd.org", phone: "225-219-7330", sortOrder: 6 },
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

  console.log("\nSeeding complete!");
}

seed().catch(console.error);
