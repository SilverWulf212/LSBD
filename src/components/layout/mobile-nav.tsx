"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, ChevronDown, LogIn, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, EXTERNAL_LINKS } from "@/lib/constants";
import { isNavItemActive, navGroups, type NavItem } from "@/lib/nav";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";

export function MobileNav() {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden min-w-[44px] min-h-[44px]"
          aria-label="Open navigation menu"
        >
          <Menu className="h-6 w-6" aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[320px] p-0">
        <SheetHeader className="border-b px-4 py-4">
          <SheetTitle className="font-[family-name:var(--font-oswald)] text-lg text-[#005f8f]">
            LSBD Menu
          </SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-140px)]">
          <nav aria-label="Mobile navigation" className="px-2 py-4">
            <ul className="space-y-1">
              {(NAV_ITEMS as readonly NavItem[]).map((item) => (
                <li key={item.label}>
                  <MobileNavCollapsible item={item} pathname={pathname} />
                </li>
              ))}
            </ul>
          </nav>
          <div className="border-t px-4 py-4 space-y-2">
            <Button
              asChild
              className="w-full min-h-[44px] bg-[#0077B6] hover:bg-[#005f8f] text-white font-[family-name:var(--font-oswald)] uppercase tracking-wide"
            >
              <Link href="/public/verify">
                <Search className="h-4 w-4 mr-2" aria-hidden="true" />
                Verify a License
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="w-full min-h-[44px] border-[#0077B6] text-[#005f8f] font-[family-name:var(--font-oswald)] uppercase tracking-wide"
            >
              <a
                href={EXTERNAL_LINKS.dentistLogin}
                target="_blank"
                rel="noopener noreferrer"
              >
                <LogIn className="h-4 w-4 mr-2" aria-hidden="true" />
                Licensee Login
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </Button>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function MobileNavCollapsible({
  item,
  pathname,
}: {
  item: NavItem;
  pathname: string;
}) {
  const isActive = isNavItemActive(item, pathname);
  const [expanded, setExpanded] = React.useState(isActive);

  return (
    <div>
      <button
        type="button"
        className={cn(
          "flex items-center justify-between w-full px-3 py-3 text-sm font-medium rounded-md transition-colors min-h-[44px]",
          "hover:bg-[#CAF0F8] hover:text-[#005f8f]",
          "focus-visible:ring-2 focus-visible:ring-[#0077B6] focus-visible:ring-offset-2 focus-visible:outline-none",
          isActive ? "bg-[#CAF0F8] text-[#005f8f]" : "text-[#495057]"
        )}
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
      >
        <span className="font-[family-name:var(--font-oswald)] uppercase tracking-wide">
          {item.label}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 transition-transform duration-200",
            expanded && "rotate-180"
          )}
          aria-hidden="true"
        />
      </button>
      {expanded && (
        <div className="ml-4 mt-1 border-l-2 border-[#0077B6] pl-3">
          {navGroups(item).map((group) => (
            <div key={group.label ?? item.label}>
              {group.label && (
                <p className="px-3 pt-3 pb-1 font-[family-name:var(--font-oswald)] text-xs uppercase tracking-wider text-[#005f8f]">
                  {group.label}
                </p>
              )}
              <ul className="space-y-1">
                {group.children.map((child) => (
                  <li key={child.href}>
                    <Link
                      href={child.href}
                      className={cn(
                        "flex items-center px-3 py-2.5 text-sm rounded-md transition-colors min-h-[44px]",
                        "hover:bg-[#CAF0F8] hover:text-[#005f8f]",
                        "focus-visible:ring-2 focus-visible:ring-[#0077B6] focus-visible:ring-offset-2 focus-visible:outline-none",
                        pathname === child.href
                          ? "text-[#005f8f] font-medium"
                          : "text-[#495057]"
                      )}
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
