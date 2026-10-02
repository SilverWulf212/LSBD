import Link from "next/link";
import { Phone, Mail, MapPin } from "lucide-react";
import { SITE_NAME, CONTACT } from "@/lib/constants";

const FOOTER_LINKS = [
  {
    heading: "For Professionals",
    links: [
      { label: "Dentist Licensure", href: "/dentists/licensure" },
      { label: "Hygienist Licensure", href: "/hygienists/licensure" },
      { label: "Dental Assistants", href: "/assistants" },
      { label: "Renewal Information", href: "/dentists/renewal" },
      { label: "Continuing Education", href: "/dentists/continuing-ed" },
    ],
  },
  {
    heading: "Public Services",
    links: [
      { label: "Verify a License", href: "/public/verify" },
      { label: "File a Complaint", href: "/public/complaints" },
      { label: "Fee Schedule", href: "/resources/fees" },
      { label: "Laws & Rules", href: "/resources/laws-and-rules" },
      { label: "Forms Library", href: "/resources/forms" },
    ],
  },
  {
    heading: "About the Board",
    links: [
      { label: "Board Members", href: "/about/board" },
      { label: "Staff Directory", href: "/about/staff" },
      { label: "Meeting Schedule", href: "/resources/meetings" },
      { label: "News & Updates", href: "/news" },
      { label: "Contact Us", href: "/about/staff" },
      { label: "Accessibility", href: "/about/policies" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer role="contentinfo" className="bg-[#495057] text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {/* Contact Info */}
          <div>
            <h2 className="font-[family-name:var(--font-oswald)] text-lg font-semibold uppercase tracking-wide mb-4">
              Contact Us
            </h2>
            <address className="not-italic space-y-3 text-sm text-gray-300">
              <div className="flex items-start gap-2">
                <MapPin
                  className="h-4 w-4 mt-0.5 shrink-0 text-[#CAF0F8]"
                  aria-hidden="true"
                />
                <span>{CONTACT.physicalAddress}</span>
              </div>
              <div className="flex items-start gap-2">
                <Mail
                  className="h-4 w-4 mt-0.5 shrink-0 text-[#CAF0F8]"
                  aria-hidden="true"
                />
                <span>{CONTACT.mailingAddress}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone
                  className="h-4 w-4 shrink-0 text-[#CAF0F8]"
                  aria-hidden="true"
                />
                <a
                  href={`tel:${CONTACT.phone.replace(/-/g, "")}`}
                  className="hover:text-[#CAF0F8] transition-colors focus-visible:ring-2 focus-visible:ring-[#CAF0F8] focus-visible:ring-offset-2 focus-visible:ring-offset-[#495057] focus-visible:outline-none rounded"
                >
                  {CONTACT.phone}
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Mail
                  className="h-4 w-4 shrink-0 text-[#CAF0F8]"
                  aria-hidden="true"
                />
                <a
                  href={`mailto:${CONTACT.email}`}
                  className="hover:text-[#CAF0F8] transition-colors focus-visible:ring-2 focus-visible:ring-[#CAF0F8] focus-visible:ring-offset-2 focus-visible:ring-offset-[#495057] focus-visible:outline-none rounded"
                >
                  {CONTACT.email}
                </a>
              </div>
            </address>
          </div>

          {/* Link Columns */}
          {FOOTER_LINKS.map((column) => (
            <div key={column.heading}>
              <h2 className="font-[family-name:var(--font-oswald)] text-lg font-semibold uppercase tracking-wide mb-4">
                {column.heading}
              </h2>
              <ul className="space-y-2">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-gray-300 hover:text-[#CAF0F8] transition-colors focus-visible:ring-2 focus-visible:ring-[#CAF0F8] focus-visible:ring-offset-2 focus-visible:ring-offset-[#495057] focus-visible:outline-none rounded inline-block py-0.5"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Bar */}
        <div className="mt-10 pt-8 border-t border-gray-400">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-center sm:text-left">
              <p className="text-sm text-gray-300">
                &copy; {new Date().getFullYear()} {SITE_NAME}. All rights reserved.
              </p>
              <p className="text-xs text-gray-300 mt-1">
                Established 1894 &mdash; Protecting the public for over 130 years.
              </p>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-200">
              <Link
                href="/about/policies"
                className="hover:text-[#CAF0F8] transition-colors focus-visible:ring-2 focus-visible:ring-[#CAF0F8] focus-visible:ring-offset-2 focus-visible:ring-offset-[#495057] focus-visible:outline-none rounded py-1"
              >
                Privacy Policy
              </Link>
              <span aria-hidden="true" className="text-gray-400">|</span>
              <Link
                href="/about/policies"
                className="hover:text-[#CAF0F8] transition-colors focus-visible:ring-2 focus-visible:ring-[#CAF0F8] focus-visible:ring-offset-2 focus-visible:ring-offset-[#495057] focus-visible:outline-none rounded py-1"
              >
                Accessibility Statement
              </Link>
              <span aria-hidden="true" className="text-gray-400">|</span>
              <a
                href="/sitemap.xml"
                className="hover:text-[#CAF0F8] transition-colors focus-visible:ring-2 focus-visible:ring-[#CAF0F8] focus-visible:ring-offset-2 focus-visible:ring-offset-[#495057] focus-visible:outline-none rounded py-1"
              >
                Sitemap
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
