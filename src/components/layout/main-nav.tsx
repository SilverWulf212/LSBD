"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/constants";
import { isNavItemActive, navGroups, type NavItem } from "@/lib/nav";

export function MainNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main navigation" className="hidden lg:block">
      <ul className="flex items-center gap-1">
        {(NAV_ITEMS as readonly NavItem[]).map((item) => (
          <li key={item.label}>
            <NavDropdown item={item} isActive={isNavItemActive(item, pathname)} pathname={pathname} />
          </li>
        ))}
      </ul>
    </nav>
  );
}

function NavDropdown({
  item,
  isActive,
  pathname,
}: {
  item: NavItem;
  isActive: boolean;
  pathname: string;
}) {
  const [open, setOpen] = React.useState(false);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const groups = navGroups(item);
  const isPanel = groups.length > 1;

  const openMenu = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setOpen(true);
  };

  const closeMenu = () => {
    timeoutRef.current = setTimeout(() => setOpen(false), 150);
  };

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Close after a link is followed (the header stays mounted across pages).
  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false);
    }
    if (e.key === "ArrowDown" && !open) {
      e.preventDefault();
      setOpen(true);
    }
  };

  return (
    <div
      className="relative"
      onMouseEnter={openMenu}
      onMouseLeave={closeMenu}
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        className={cn(
          "inline-flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-md transition-colors min-h-[44px]",
          "hover:bg-[#CAF0F8] hover:text-[#005f8f]",
          "focus-visible:ring-2 focus-visible:ring-[#0077B6] focus-visible:ring-offset-2 focus-visible:outline-none",
          isActive
            ? "bg-[#CAF0F8] text-[#005f8f] font-semibold"
            : "text-[#495057]"
        )}
        aria-expanded={open}
        aria-haspopup="true"
        onFocus={openMenu}
        onBlur={closeMenu}
      >
        <span className="font-[family-name:var(--font-oswald)] uppercase tracking-wide text-[13px]">
          {item.label}
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 transition-transform duration-200",
            open && "rotate-180"
          )}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div
          className={cn(
            "absolute left-0 top-full z-50 mt-1 rounded-md border border-gray-200 bg-white shadow-lg",
            isPanel ? "flex gap-2 p-3" : "min-w-[220px] py-1"
          )}
        >
          {groups.map((group) => (
            <div key={group.label ?? item.label} className={cn(isPanel && "w-[210px]")}>
              {group.label && (
                <p className="px-3 pb-1 pt-2 font-[family-name:var(--font-oswald)] text-xs uppercase tracking-wider text-[#005f8f] border-b border-gray-200 mb-1">
                  {group.label}
                </p>
              )}
              <ul>
                {group.children.map((child) => (
                  <li key={child.href}>
                    <Link
                      href={child.href}
                      aria-current={pathname === child.href ? "page" : undefined}
                      className={cn(
                        "flex items-center rounded-sm py-2.5 text-sm transition-colors min-h-[44px] hover:bg-[#CAF0F8] hover:text-[#005f8f] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0077B6] focus-visible:outline-none",
                        isPanel ? "px-3" : "px-4",
                        pathname === child.href ? "text-[#005f8f] font-medium" : "text-[#495057]"
                      )}
                      onFocus={openMenu}
                      onBlur={closeMenu}
                    >
                      {child.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
