export const SITE_NAME = "Louisiana State Board of Dentistry";
export const SITE_DESCRIPTION = "Protecting the public by regulating the professions of dentistry and dental hygiene in Louisiana.";
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || process.env.AUTH_URL || "https://lsbd.org";

export const CONTACT = {
  phone: "225-219-7330",
  fax: "225-219-0707",
  mailingAddress: "P.O. Box 5256, Baton Rouge, Louisiana 70821-5256",
  physicalAddress: "18212 East Petroleum Drive, Suite 2-B, Baton Rouge, Louisiana 70809",
  email: "info@lsbd.org",
} as const;

export const EXTERNAL_LINKS = {
  dentistLogin: "https://www.membersbase.com/lsbd/dentist",
  hygienistLogin: "https://www.membersbase.com/lsbd/hygienist",
  licenseVerification: "/public/verify",
  ceBroker: "https://www.cebroker.com/la/account_options",
  reportFraud: "https://www.ReportFraud.La",
} as const;

// The public menu, grouped by audience. An item has either `groups` (a panel with one
// labelled column per group) or `children` (a plain dropdown). `href` is the section's
// own overview page when it has one; it is not shown in the menu but is kept for the
// sitemap and site search. Helpers are in src/lib/nav.ts.
export const NAV_ITEMS = [
  {
    label: "Licensees",
    groups: [
      {
        label: "Dentists",
        children: [
          { label: "Overview", href: "/dentists" },
          { label: "Licensure Pathways", href: "/dentists/licensure" },
          { label: "Renewal", href: "/dentists/renewal" },
          { label: "Continuing Education", href: "/dentists/continuing-ed" },
        ],
      },
      {
        label: "Hygienists",
        children: [
          { label: "Overview", href: "/hygienists" },
          { label: "Licensure Pathways", href: "/hygienists/licensure" },
          { label: "Renewal", href: "/hygienists/renewal" },
          { label: "Continuing Education", href: "/hygienists/continuing-ed" },
        ],
      },
      {
        label: "Assistants",
        children: [{ label: "Dental Assisting & EDDA", href: "/assistants" }],
      },
    ],
  },
  {
    label: "Public",
    href: "/public",
    children: [
      { label: "Verify a License", href: "/public/verify" },
      { label: "File a Complaint", href: "/public/complaints" },
    ],
  },
  {
    label: "Resources",
    href: "/resources",
    children: [
      { label: "Laws & Rules", href: "/resources/laws-and-rules" },
      { label: "Rulemaking", href: "/resources/rulemaking" },
      { label: "Fee Schedule", href: "/resources/fees" },
      { label: "Forms", href: "/resources/forms" },
      { label: "Meetings & Minutes", href: "/resources/meetings" },
      { label: "Publications", href: "/resources/publications" },
    ],
  },
  {
    label: "About",
    href: "/about",
    children: [
      { label: "Overview", href: "/about" },
      { label: "Board Members", href: "/about/board" },
      { label: "Staff Directory", href: "/about/staff" },
      { label: "Policies", href: "/about/policies" },
      { label: "News", href: "/news" },
    ],
  },
] as const;

export const FORM_CATEGORIES = [
  { key: "change_of_info", label: "Licensee Change of Information" },
  { key: "dental_anesthesia", label: "Dental Anesthesia Permit Applications" },
  { key: "hygiene_anesthesia", label: "Dental Hygiene Anesthesia Permits" },
  { key: "mobile_portable", label: "Mobile or Portable Dental Office" },
  { key: "opioid", label: "Opioid Management CE Exemption" },
  { key: "cdc_inspection", label: "Dental Office CDC Inspection" },
  { key: "controlled_substances", label: "Controlled Substances" },
  { key: "additional", label: "Additional Applications" },
  { key: "miscellaneous", label: "Miscellaneous Publications and Forms" },
] as const;

export const MEETING_TYPES = [
  { key: "board", label: "Board Meeting" },
  { key: "disciplinary", label: "Disciplinary Oversight Committee" },
  { key: "office_management", label: "Office Management Committee" },
  { key: "nominating", label: "Nominating Committee" },
  { key: "act454", label: "Act 454 Meeting" },
] as const;
