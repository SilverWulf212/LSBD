import { describe, expect, it } from "vitest";
import { sanitizePostHtml } from "../../src/lib/sanitize-post-html";

const kept =
  "<h2>Title</h2><p><strong>b</strong> <em>i</em> <u>u</u> <s>s</s></p>" +
  "<blockquote><p>q</p></blockquote><ul><li><p>a</p></li></ul><ol><li><p>b</p></li></ol>" +
  "<hr /><p>x<br />y</p>" +
  '<table><tbody><tr><th colspan="2"><p>h</p></th></tr><tr><td rowspan="2"><p>c</p></td></tr></tbody></table>';

describe("sanitizePostHtml", () => {
  it("drops script elements and keeps the rest", () => {
    const out = sanitizePostHtml("<p>Hi</p><script>alert(1)</script>");
    expect(out).toContain("<p>Hi</p>");
    expect(out).not.toContain("script");
  });
  it("drops event handler attributes", () => {
    expect(sanitizePostHtml('<img src="x" onerror="alert(1)">')).not.toContain("onerror");
  });
  it("drops javascript: and data: hrefs", () => {
    expect(sanitizePostHtml('<a href="JaVaScRiPt:alert(1)">x</a>')).not.toContain("href");
    expect(sanitizePostHtml('<a href="data:text/html,<script>alert(1)</script>">x</a>')).not.toContain("href");
  });
  it("drops protocol-relative and backslash hrefs", () => {
    expect(sanitizePostHtml('<a href="//evil.example/x">x</a>')).not.toContain("href");
    expect(sanitizePostHtml('<a href="/\\evil.example/x">x</a>')).not.toContain("href");
  });
  it("removes svg, iframe, style and form", () => {
    expect(sanitizePostHtml('<svg onload="alert(1)"></svg>')).not.toMatch(/svg|onload/);
    expect(sanitizePostHtml('<iframe src="https://evil.example"></iframe>')).not.toContain("iframe");
    expect(sanitizePostHtml("<style>body{display:none}</style>")).not.toMatch(/style|display/);
    expect(sanitizePostHtml('<form action="https://evil.example"><input></form>')).not.toMatch(/form|action|input/);
  });
  it("keeps the editor's formatting unchanged", () => {
    expect(sanitizePostHtml(kept)).toBe(kept);
  });
  it("is idempotent", () => {
    const once = sanitizePostHtml(kept);
    expect(sanitizePostHtml(once)).toBe(once);
  });
  it("keeps text-align and drops other styles", () => {
    expect(sanitizePostHtml('<p style="text-align: center">x</p>')).toContain('style="text-align:center"');
    const bad = sanitizePostHtml('<p style="position:fixed;background:url(javascript:1)">x</p>');
    expect(bad).not.toMatch(/style|position|javascript/);
  });
  it("keeps https link with target and adds rel noopener", () => {
    const out = sanitizePostHtml('<a href="https://example.gov/a" target="_blank">x</a>');
    expect(out).toContain('href="https://example.gov/a"');
    expect(out).toContain('target="_blank"');
    expect(out).toMatch(/rel="[^"]*noopener/);
  });
  it("keeps site-relative and mailto links", () => {
    expect(sanitizePostHtml('<a href="/resources/fees">x</a>')).toContain('href="/resources/fees"');
    expect(sanitizePostHtml('<a href="mailto:info@lsbd.org">x</a>')).toContain('href="mailto:info@lsbd.org"');
  });
  it("keeps https images, drops http image src", () => {
    const ok = sanitizePostHtml('<img src="https://abc.public.blob.vercel-storage.com/images/a.png" alt="A">');
    expect(ok).toContain('src="https://abc.public.blob.vercel-storage.com/images/a.png"');
    expect(ok).toContain('alt="A"');
    expect(sanitizePostHtml('<img src="http://example.com/a.png">')).not.toContain("src");
  });
  it("keeps the editor's own classes and table sizing, drops unknown classes", () => {
    const img = '<img src="https://a.example/a.png" class="rounded-md max-w-full h-auto" width="10" height="20">';
    expect(sanitizePostHtml(img)).toContain('class="rounded-md max-w-full h-auto"');
    expect(sanitizePostHtml(img)).toContain('width="10"');
    expect(sanitizePostHtml('<img src="https://a.example/a.png" width="1&quot;onload=x">')).not.toContain("width");
    expect(sanitizePostHtml('<p class="evil">x</p>')).toBe("<p>x</p>");
    expect(sanitizePostHtml('<table><colgroup><col style="width: 50px"></colgroup><tbody><tr><td data-colwidth="50"><p>x</p></td></tr></tbody></table>'))
      .toContain('data-colwidth="50"');
  });
  it("keeps code blocks", () => {
    const code = '<pre><code class="language-js">x</code></pre><p><code>y</code></p>';
    expect(sanitizePostHtml(code)).toBe(code);
  });
});
