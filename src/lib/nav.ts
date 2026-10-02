import { NAV_ITEMS } from "./constants";

export interface NavLink {
  label: string;
  href: string;
}

export interface NavGroup {
  /** Column heading; absent for a plain dropdown. */
  label?: string;
  children: readonly NavLink[];
}

export interface NavItem {
  label: string;
  /** The section's own overview page, if it has one. */
  href?: string;
  groups?: readonly NavGroup[];
  children?: readonly NavLink[];
}

export interface NavPage {
  title: string;
  href: string;
  section: string;
}

/** The item's links as columns: its groups, or its children as one unlabelled group. */
export function navGroups(item: NavItem): readonly NavGroup[] {
  return item.groups ?? [{ children: item.children ?? [] }];
}

/** Every link shown under the item, in menu order. */
export function navLinks(item: NavItem): NavLink[] {
  return navGroups(item).flatMap((g) => [...g.children]);
}

function owns(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

/** True when the current page is the item's overview page or sits under one of its links. */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.href && owns(item.href, pathname)) return true;
  return navLinks(item).some((l) => owns(l.href, pathname));
}

/** Each page the menu knows about, once: for the sitemap and the site search. */
export function allNavPages(): NavPage[] {
  const pages = new Map<string, NavPage>();
  const add = (p: NavPage) => {
    if (!pages.has(p.href)) pages.set(p.href, p);
  };
  for (const item of NAV_ITEMS as readonly NavItem[]) {
    if (item.href) add({ title: item.label, href: item.href, section: "Pages" });
    for (const group of navGroups(item)) {
      const section = group.label ?? item.label;
      for (const link of group.children) {
        add({ title: `${section} - ${link.label}`, href: link.href, section });
      }
    }
  }
  return [...pages.values()];
}
