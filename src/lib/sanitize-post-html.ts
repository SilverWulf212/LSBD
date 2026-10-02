import sanitizeHtml from "sanitize-html";

// Allow-list for news post HTML. It covers what the admin Tiptap editor emits
// (see src/components/admin/rich-text-editor.tsx: StarterKit, underline, link,
// image, text-align, table) and nothing that can run script or load other pages.

const ALLOWED_TAGS = [
  "p", "br", "hr", "h2", "h3", "h4",
  "strong", "em", "u", "s", "code", "pre", "blockquote",
  "ul", "ol", "li", "a", "img",
  "table", "colgroup", "col", "thead", "tbody", "tr", "th", "td",
];

// A link or image target is kept only if it is https, mailto (links), or a
// site-relative path: one leading "/" and not "//host" or "/\host", which
// browsers treat as protocol-relative.
function isSafeTarget(url: string): boolean {
  const u = url.trim();
  if (u.startsWith("/")) return !/^\/[/\\]/.test(u);
  return /^https:\/\//i.test(u) || /^mailto:/i.test(u);
}

function keepIfMatches(attribs: Record<string, string>, name: string, re: RegExp) {
  if (name in attribs && !re.test(attribs[name])) delete attribs[name];
}

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {
    a: ["href", "target", "rel", "class"],
    img: ["src", "alt", "title", "class", "width", "height"],
    code: ["class"],
    p: ["style"],
    h2: ["style"],
    h3: ["style"],
    h4: ["style"],
    table: ["style"],
    col: ["style"],
    th: ["colspan", "rowspan", "data-colwidth"],
    td: ["colspan", "rowspan", "data-colwidth"],
  },
  allowedClasses: {
    a: ["text-primary", "underline"],
    img: ["rounded-md", "max-w-full", "h-auto"],
    code: [/^language-[\w-]+$/],
  },
  allowedStyles: {
    p: { "text-align": [/^(left|right|center|justify)$/] },
    h2: { "text-align": [/^(left|right|center|justify)$/] },
    h3: { "text-align": [/^(left|right|center|justify)$/] },
    h4: { "text-align": [/^(left|right|center|justify)$/] },
    table: { "min-width": [/^\d+px$/], width: [/^\d+px$/] },
    col: { "min-width": [/^\d+px$/], width: [/^\d+px$/] },
  },
  allowedSchemes: ["https", "mailto"],
  allowedSchemesAppliedToAttributes: ["href", "src"],
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
  transformTags: {
    a: (tagName, attribs) => {
      if (attribs.href !== undefined && !isSafeTarget(attribs.href)) delete attribs.href;
      if (attribs.target) attribs.rel = "noopener noreferrer";
      return { tagName, attribs };
    },
    img: (tagName, attribs) => {
      // Images are https or site-relative only; never mailto.
      if (attribs.src !== undefined && (!isSafeTarget(attribs.src) || /^mailto:/i.test(attribs.src.trim()))) {
        delete attribs.src;
      }
      keepIfMatches(attribs, "width", /^\d{1,5}$/);
      keepIfMatches(attribs, "height", /^\d{1,5}$/);
      return { tagName, attribs };
    },
    th: (tagName, attribs) => cell(tagName, attribs),
    td: (tagName, attribs) => cell(tagName, attribs),
  },
};

function cell(tagName: string, attribs: Record<string, string>) {
  keepIfMatches(attribs, "colspan", /^\d{1,3}$/);
  keepIfMatches(attribs, "rowspan", /^\d{1,3}$/);
  keepIfMatches(attribs, "data-colwidth", /^\d{1,5}(,\d{1,5})*$/);
  return { tagName, attribs };
}

export function sanitizePostHtml(html: string): string {
  return sanitizeHtml(html, OPTIONS);
}
