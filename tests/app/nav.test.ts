import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { NAV_ITEMS } from "../../src/lib/constants";
import { allNavPages, isNavItemActive, navGroups, navLinks } from "../../src/lib/nav";

// Every static public page, read from the route folders.
function publicRoutes(): string[] {
  const root = path.resolve(__dirname, "../../src/app/(public)");
  const out: string[] = [];
  const walk = (dir: string, route: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) {
        if (!e.name.startsWith("[")) walk(path.join(dir, e.name), `${route}/${e.name}`);
      } else if (e.name === "page.tsx" && route) {
        out.push(route);
      }
    }
  };
  walk(root, "");
  return out.sort();
}

describe("public navigation", () => {
  it("has four top-level items, grouped by audience", () => {
    expect(NAV_ITEMS.map((i) => i.label)).toEqual(["Licensees", "Public", "Resources", "About"]);
    expect(navGroups(NAV_ITEMS[0]).map((g) => g.label)).toEqual(["Dentists", "Hygienists", "Assistants"]);
  });

  it("an item without groups is one unlabelled group of its children", () => {
    const groups = navGroups(NAV_ITEMS[1]);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBeUndefined();
    expect(groups[0].children.map((c) => c.href)).toEqual(["/public/verify", "/public/complaints"]);
  });

  it("does not link the same page twice in the menu", () => {
    const hrefs = NAV_ITEMS.flatMap((i) => navLinks(i).map((l) => l.href));
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("covers every static public page (menu link or section overview)", () => {
    const known = new Set(allNavPages().map((p) => p.href));
    expect(publicRoutes().filter((r) => !known.has(r))).toEqual([]);
  });

  it("lists each page once for the sitemap and site search", () => {
    const hrefs = allNavPages().map((p) => p.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs).toContain("/public");
    expect(hrefs).toContain("/resources");
    expect(hrefs).toContain("/news");
  });

  it("marks the item that owns the current page as active", () => {
    const [licensees, pub, resources, about] = NAV_ITEMS;
    expect(isNavItemActive(licensees, "/hygienists/renewal")).toBe(true);
    expect(isNavItemActive(licensees, "/assistants")).toBe(true);
    expect(isNavItemActive(pub, "/public/verify/D-1234")).toBe(true);
    expect(isNavItemActive(pub, "/public")).toBe(true);
    expect(isNavItemActive(resources, "/resources/fees")).toBe(true);
    expect(isNavItemActive(about, "/news/some-post")).toBe(true);
    expect(isNavItemActive(about, "/dentists")).toBe(false);
    expect(isNavItemActive(licensees, "/")).toBe(false);
    expect(NAV_ITEMS.filter((i) => isNavItemActive(i, "/about/board"))).toEqual([about]);
  });
});
