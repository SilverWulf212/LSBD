"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/constants";

export function MainNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main navigation" className="hidden lg:block">
      <ul className="flex items-center gap-0.5">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const hasChildren = "children" in item && item.children;

          if (!hasChildren) {
            return (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className={cn(
                    "inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors min-h-[44px]",
                    "hover:bg-[#CAF0F8] hover:text-[#005f8f]",
                    "focus-visible:ring-2 focus-visible:ring-[#0077B6] focus-visible:ring-offset-2 focus-visible:outline-none",
                    isActive
                      ? "bg-[#CAF0F8] text-[#005f8f] font-semibold"
                      : "text-[#495057]"
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <span className="font-[family-name:var(--font-oswald)] uppercase tracking-wide text-[13px]">
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          }

          return (
            <li key={item.label}>
              <NavDropdown item={item} isActive={isActive} />
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

interface NavItemWithChildren {
  label: string;
  href: string;
  children: readonly { label: string; href: string }[];
}

function NavDropdown({
  item,
  isActive,
}: {
  item: NavItemWithChildren;
  isActive: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

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
        <ul
          role="menu"
          className="absolute left-0 top-full z-50 mt-1 min-w-[220px] rounded-md border border-gray-200 bg-white py-1 shadow-lg"
        >
          {item.children.map((child) => (
            <li key={child.href} role="none">
              <Link
                href={child.href}
                role="menuitem"
                className="flex items-center px-4 py-2.5 text-sm text-[#495057] transition-colors min-h-[44px] hover:bg-[#CAF0F8] hover:text-[#005f8f] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0077B6] focus-visible:outline-none"
                onFocus={openMenu}
                onBlur={closeMenu}
              >
                {child.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
