"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { NAV_ITEMS } from "@/lib/constants";

const SEARCHABLE_PAGES = [
  { title: "Home", href: "/", section: "Pages" },
  ...NAV_ITEMS.flatMap((item) => {
    const pages = [{ title: item.label, href: item.href, section: "Pages" }];
    if ("children" in item && item.children) {
      item.children.forEach((child) => {
        pages.push({
          title: `${item.label} - ${child.label}`,
          href: child.href,
          section: item.label,
        });
      });
    }
    return pages;
  }),
];

export function SearchDialog() {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = React.useCallback(
    (command: () => unknown) => {
      setOpen(false);
      command();
    },
    []
  );

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="relative h-9 w-9 p-0 xl:h-9 xl:w-60 xl:justify-start xl:px-3 xl:py-2 min-w-[44px] min-h-[44px]"
        onClick={() => setOpen(true)}
        aria-label="Search pages. Press Control+K to open."
      >
        <Search className="h-4 w-4 xl:mr-2" aria-hidden="true" />
        <span className="hidden xl:inline-flex text-muted-foreground text-sm">
          Search pages...
        </span>
        <kbd className="pointer-events-none hidden xl:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground ml-auto">
          <span className="text-xs">Ctrl</span>K
        </kbd>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search Pages"
        description="Search for pages on the LSBD website"
      >
        <CommandInput placeholder="Search pages..." />
        <CommandList>
          <CommandEmpty>No pages found.</CommandEmpty>
          <CommandGroup heading="Pages">
            {SEARCHABLE_PAGES.map((page) => (
              <CommandItem
                key={page.href}
                value={page.title}
                onSelect={() => runCommand(() => router.push(page.href))}
                className="min-h-[44px]"
              >
                <Search className="mr-2 h-4 w-4" aria-hidden="true" />
                <span>{page.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
