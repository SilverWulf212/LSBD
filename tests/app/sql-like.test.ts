import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { escapeLike } from "../../src/lib/sql-like";

describe("escapeLike", () => {
  it("escapes LIKE metacharacters and the escape character", () => {
    expect(escapeLike("100%_a\\b")).toBe("100\\%\\_a\\\\b");
    expect(escapeLike("smith")).toBe("smith");
    expect(escapeLike("")).toBe("");
  });
});
describe("/api/search", () => {
  const src = readFileSync("src/app/api/search/route.ts", "utf8");
  it("filters posts to published and escapes the term", () => {
    expect(src).toContain('eq(posts.status, "published")');
    expect(src).toContain("escapeLike(");
  });
  it("filters meetings to published", () => {
    expect(src).toContain("eq(meetings.isPublished, true)");
  });
});
