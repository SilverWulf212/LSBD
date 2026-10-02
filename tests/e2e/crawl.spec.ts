import fs from "node:fs";
import path from "node:path";
import type { APIRequestContext } from "@playwright/test";
import { allNavPages } from "../../src/lib/nav";
import { test, expect, ORIGIN } from "./helpers/fixtures";

// Link crawl of the public site in a real browser. Starts from the home page, every
// page the menu knows about and every sitemap entry, then follows each same-origin
// link it finds. One page at a time, with a pause between pages.

const MAX_PAGES = Number(process.env.E2E_MAX_PAGES || 200);
const DELAY_MS = Number(process.env.E2E_CRAWL_DELAY_MS || 400);
const REPORT_DIR = "e2e-results";

// The site's own uploaded files live on the Vercel Blob host: a dead one is a site defect.
const BLOB_HOST = /\.public\.blob\.vercel-storage\.com$/i;
// Paths with a file extension are fetched with HEAD/GET, not opened in the browser.
const FILE_PATH = /\.(?!html?$)[a-z0-9]{2,5}$/i;

interface Finding {
  page: string;
  linkedFrom: string[];
  problem: string;
}

interface LinkRef {
  from: string;
  text: string;
}

function normalise(raw: string, base: string): URL | null {
  try {
    const u = new URL(raw, base);
    u.hash = "";
    if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/, "");
    return u;
  } catch {
    return null;
  }
}

/** HEAD first; fall back to GET when the server refuses HEAD or answers with an error. */
async function probe(
  request: APIRequestContext,
  url: string
): Promise<{ status: number; finalUrl?: string; error?: string }> {
  const opts = { timeout: 20_000, failOnStatusCode: false, maxRedirects: 5 };
  try {
    const head = await request.head(url, opts);
    if (head.status() < 400) return { status: head.status(), finalUrl: head.url() };
  } catch {
    // fall through to GET
  }
  try {
    const get = await request.get(url, opts);
    return { status: get.status(), finalUrl: get.url() };
  } catch (e) {
    return { status: 0, error: (e as Error).message.split("\n")[0] };
  }
}

test("crawl every public link", async ({ page, request, monitor }) => {
  test.setTimeout(30 * 60_000);
  monitor.autoAssert = false; // problems are recorded per page and reported together

  const findings: Finding[] = [];
  const notes: string[] = [];
  const referrers = new Map<string, LinkRef[]>();
  const queue: string[] = [];
  const queued = new Set<string>();
  const files = new Set<string>();
  const external = new Set<string>();
  const skipped = new Set<string>();
  const visited: { url: string; status: number; finalUrl: string; images: number; links: number }[] = [];

  const refsOf = (url: string) =>
    [...new Set((referrers.get(url) ?? []).map((r) => (r.text ? `${r.from} ("${r.text}")` : r.from)))].slice(0, 5);
  const fail = (url: string, problem: string) => findings.push({ page: url, linkedFrom: refsOf(url), problem });

  const consider = (raw: string, from: string, text: string) => {
    const lower = raw.trim().toLowerCase();
    if (lower.startsWith("mailto:")) {
      if (!/^mailto:[^@\s]+@[^@\s]+\.[a-z]{2,}/i.test(raw.trim())) fail(from, `malformed mailto link: ${raw}`);
      return;
    }
    if (lower.startsWith("tel:")) {
      if (raw.replace(/\D/g, "").length < 10) fail(from, `malformed tel link: ${raw}`);
      return;
    }
    const u = normalise(raw, from);
    if (!u || !/^https?:$/.test(u.protocol)) return;
    const key = u.toString();
    const refs = referrers.get(key) ?? [];
    refs.push({ from, text });
    referrers.set(key, refs);

    if (u.origin !== ORIGIN) {
      if (BLOB_HOST.test(u.hostname)) files.add(key);
      else external.add(key);
      return;
    }
    if (/^\/(admin|api|_next)(\/|$)/.test(u.pathname)) {
      skipped.add(key);
      return;
    }
    // A licence search with a query string costs a rate-limited lookup; verify.spec.ts covers it.
    if (u.pathname.startsWith("/public/verify") && u.search) {
      skipped.add(key);
      return;
    }
    if (FILE_PATH.test(u.pathname)) {
      files.add(key);
      return;
    }
    if (!queued.has(key)) {
      queued.add(key);
      queue.push(key);
    }
  };

  // Seeds: home, the menu, the sitemap.
  consider("/", `${ORIGIN}/ (seed)`, "");
  for (const p of allNavPages()) consider(p.href, `${ORIGIN}/ (menu: ${p.title})`, "");

  const sitemapUrl = `${ORIGIN}/sitemap.xml`;
  const sitemap = await request.get(sitemapUrl, { failOnStatusCode: false });
  if (sitemap.status() !== 200) {
    findings.push({ page: sitemapUrl, linkedFrom: [], problem: `sitemap returned HTTP ${sitemap.status()}` });
  } else {
    const locs = [...(await sitemap.text()).matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
    const hosts = new Set<string>();
    for (const loc of locs) {
      const u = normalise(loc.replace(/&amp;/g, "&"), ORIGIN);
      if (!u) continue;
      hosts.add(u.origin);
      consider(u.pathname + u.search, `${sitemapUrl} (sitemap)`, "");
    }
    notes.push(`sitemap.xml lists ${locs.length} URLs on ${[...hosts].join(", ") || "(none)"}`);
    if (locs.length === 0) findings.push({ page: sitemapUrl, linkedFrom: [], problem: "sitemap has no <loc> entries" });
  }

  // Crawl.
  while (queue.length > 0) {
    if (visited.length >= MAX_PAGES) {
      notes.push(`stopped at E2E_MAX_PAGES=${MAX_PAGES} with ${queue.length} pages still queued`);
      break;
    }
    const url = queue.shift()!;
    monitor.reset();

    let status = 0;
    let finalUrl = url;
    try {
      const response = await page.goto(url, { waitUntil: "load" });
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      status = response?.status() ?? 0;
      finalUrl = page.url();
    } catch (e) {
      fail(url, `navigation failed: ${(e as Error).message.split("\n")[0]}`);
      continue;
    }

    if (status >= 400 || status === 0) {
      fail(url, `HTTP ${status}`);
      visited.push({ url, status, finalUrl, images: 0, links: 0 });
      await page.waitForTimeout(DELAY_MS);
      continue;
    }
    const landed = normalise(finalUrl, ORIGIN);
    if (landed && landed.origin !== ORIGIN) {
      fail(url, `redirected off the site to ${finalUrl}`);
      visited.push({ url, status, finalUrl, images: 0, links: 0 });
      continue;
    }

    // Force every image to load (lazy ones included), then read the page.
    const dom = await page.evaluate(async () => {
      const imgs = Array.from(document.images);
      for (const img of imgs) img.loading = "eager";
      for (let y = 0; y < document.documentElement.scrollHeight; y += 600) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 40));
      }
      window.scrollTo(0, 0);
      const deadline = Date.now() + 15_000;
      while (imgs.some((i) => !i.complete) && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 200));
      }
      return {
        h1: Array.from(document.querySelectorAll("h1")).map((h) => (h.textContent || "").trim()),
        images: imgs.map((i) => ({
          src: i.currentSrc || i.getAttribute("src") || "",
          alt: i.alt,
          complete: i.complete,
          width: i.naturalWidth,
        })),
        links: Array.from(document.querySelectorAll("a[href]")).map((a) => {
          const raw = a.getAttribute("href") || "";
          return {
            raw,
            text: (a.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80),
            // "#x" must point at an element on the page
            deadFragment: raw.length > 1 && raw.startsWith("#") && !document.getElementById(raw.slice(1)),
          };
        }),
      };
    });
    await page.waitForTimeout(300); // let late console / CSP reports arrive

    for (const line of monitor.all()) fail(url, line);
    if (dom.h1.length !== 1) {
      fail(url, `expected exactly one <h1>, found ${dom.h1.length}${dom.h1.length ? `: ${JSON.stringify(dom.h1)}` : ""}`);
    }
    for (const img of dom.images) {
      if (!img.complete) fail(url, `image never finished loading: ${img.src} (alt "${img.alt}")`);
      else if (img.width === 0) fail(url, `image failed to load: ${img.src} (alt "${img.alt}")`);
    }
    for (const link of dom.links) {
      const raw = link.raw.trim();
      if (raw === "" || raw === "#" || raw.toLowerCase().startsWith("javascript:")) {
        fail(url, `placeholder link (href="${link.raw}"): "${link.text}"`);
      } else if (link.deadFragment) {
        fail(url, `link to a fragment that does not exist (${raw}): "${link.text}"`);
      } else if (!raw.startsWith("#")) {
        consider(raw, finalUrl, link.text);
      }
    }
    visited.push({ url, status, finalUrl, images: dom.images.length, links: dom.links.length });
    await page.waitForTimeout(DELAY_MS);
  }

  // Files (same-origin downloads, feeds, uploaded blobs): status only.
  const fileResults: { url: string; status: number; finalUrl?: string; error?: string }[] = [];
  for (const url of files) {
    const r = await probe(request, url);
    fileResults.push({ url, ...r });
    if (r.status === 0 || r.status >= 400) fail(url, `file link is broken: ${r.error ?? `HTTP ${r.status}`}`);
  }

  // External links: warnings only (third-party sites often refuse automated requests).
  const externalResults: { url: string; status: number; finalUrl?: string; error?: string; linkedFrom: string[] }[] = [];
  for (const url of external) {
    const r = await probe(request, url);
    externalResults.push({ url, ...r, linkedFrom: refsOf(url) });
  }
  const externalWarnings = externalResults.filter((r) => r.status === 0 || r.status >= 400);

  const report = {
    baseUrl: ORIGIN,
    finishedAt: new Date().toISOString(),
    totals: {
      pagesCrawled: visited.length,
      linksSeen: referrers.size,
      filesChecked: fileResults.length,
      externalChecked: externalResults.length,
      externalWarnings: externalWarnings.length,
      skipped: skipped.size,
      findings: findings.length,
    },
    findings,
    externalWarnings,
    notes,
    visited,
    files: fileResults,
    external: externalResults,
    skipped: [...skipped],
  };
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(path.join(REPORT_DIR, "crawl-report.json"), JSON.stringify(report, null, 2));

  // One block per page: where it is linked from, then each problem.
  const byPage = new Map<string, Finding[]>();
  for (const f of findings) byPage.set(f.page, [...(byPage.get(f.page) ?? []), f]);
  const summary = [
    `crawled ${visited.length} pages, saw ${referrers.size} distinct links, checked ${fileResults.length} files and ${externalResults.length} external links`,
    ...notes.map((n) => `note: ${n}`),
    ...externalWarnings.map((w) => `external warning: ${w.url} -> ${w.error ?? `HTTP ${w.status}`}`),
    ...[...byPage].map(([pageUrl, list]) =>
      [
        `FAIL ${pageUrl}`,
        ...(list[0].linkedFrom.length ? [`     linked from: ${list[0].linkedFrom.join("; ")}`] : []),
        ...list.map((f) => `     - ${f.problem}`),
      ].join("\n")
    ),
  ].join("\n");
  if (findings.length === 0) console.log(summary);

  expect(visited.length, "the crawl should reach more than the home page").toBeGreaterThan(10);
  expect(
    findings.length,
    `${findings.length} problems on ${byPage.size} pages (full report: ${REPORT_DIR}/crawl-report.json)\n${summary}`
  ).toBe(0);
});
