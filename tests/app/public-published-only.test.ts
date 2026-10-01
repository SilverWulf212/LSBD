import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(p, "utf8");
const count = (src: string, needle: string) => src.split(needle).length - 1;

const POSTS_PUBLISHED = 'eq(posts.status, "published")';
const MEETINGS_PUBLISHED = "eq(meetings.isPublished, true)";

describe("public pages read published content only", () => {
  it("/news/[slug] filters both of its queries", () => {
    const src = read("src/app/(public)/news/[slug]/page.tsx");
    expect(count(src, POSTS_PUBLISHED)).toBeGreaterThanOrEqual(2);
    expect(count(src, ".from(posts)")).toBe(2);
  });

  it.each([
    "src/app/(public)/news/page.tsx",
    "src/app/(public)/news/feed.xml/route.ts",
    "src/app/sitemap.ts",
    "src/app/page.tsx",
  ])("%s filters posts", (file) => {
    const src = read(file);
    expect(count(src, POSTS_PUBLISHED)).toBe(count(src, ".from(posts)"));
    expect(count(src, POSTS_PUBLISHED)).toBeGreaterThan(0);
  });

  it.each(["src/app/(public)/resources/meetings/page.tsx", "src/app/page.tsx"])(
    "%s filters meetings",
    (file) => {
      const src = read(file);
      expect(count(src, MEETINGS_PUBLISHED)).toBe(count(src, "db.query.meetings.findMany("));
      expect(count(src, MEETINGS_PUBLISHED)).toBeGreaterThan(0);
    },
  );
});

describe("user rows sent to the admin UI", () => {
  const src = read("src/actions/users.ts");
  it("never selects whole user rows", () => {
    expect(src).not.toMatch(/\.select\(\)\s*\.from\(users\)/);
  });
  it("the read functions return SafeUser", () => {
    expect(src).toContain("Promise<SafeUser[]>");
    expect(src).toContain("Promise<SafeUser | null>");
  });
  it("the client components take SafeUser", () => {
    for (const file of ["src/app/admin/users/users-table.tsx", "src/components/admin/user-form.tsx"]) {
      expect(read(file)).not.toMatch(/import type \{ User \}/);
    }
  });
});
