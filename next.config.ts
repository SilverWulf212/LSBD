import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.public.blob.vercel-storage.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self'; frame-ancestors 'none'",
          },
        ],
      },
      {
        source: "/:path*.(jpg|jpeg|png|gif|svg|webp|avif|ico)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/_next/image/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
        ],
      },
      {
        // Edge caching for public HTML pages (does not affect admin routes)
        source: "/((?!admin|api|_next|public/verify(?:/|$)).*)",
        headers: [
          {
            key: "CDN-Cache-Control",
            value: "public, max-age=60, stale-while-revalidate=300",
          },
        ],
      },
      {
        // License lookups are per-request (rate limited by IP): never cached
        source: "/public/verify",
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      },
      {
        source: "/public/verify/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      },
    ];
  },
  async redirects() {
    return [
      { source: "/dentalact.htm", destination: "/resources/laws-and-rules", permanent: true },
      { source: "/boardinfo.htm", destination: "/about/board", permanent: true },
      { source: "/renewals.htm", destination: "/dentists/renewal", permanent: true },
      { source: "/fees.htm", destination: "/resources/fees", permanent: true },
      { source: "/licenseinfo.htm", destination: "/dentists/licensure", permanent: true },
      { source: "/licenseverification.htm", destination: "/public/verify", permanent: true },
      { source: "/conted.htm", destination: "/dentists/continuing-ed", permanent: true },
      { source: "/dentalassist.htm", destination: "/assistants", permanent: true },
      { source: "/complaints.htm", destination: "/public/complaints", permanent: true },
      { source: "/pubs.htm", destination: "/resources/publications", permanent: true },
      { source: "/minutes.htm", destination: "/resources/meetings", permanent: true },
      { source: "/forms.htm", destination: "/resources/forms", permanent: true },
      { source: "/rulemaking.htm", destination: "/resources/rulemaking", permanent: true },
      { source: "/search.htm", destination: "/", permanent: true },
      { source: "/contactus.htm", destination: "/about/staff", permanent: true },
      { source: "/contact", destination: "/about/staff", permanent: true },
      { source: "/privacy-policy", destination: "/about/policies", permanent: true },
      { source: "/privacy", destination: "/about/policies", permanent: true },
    ];
  },
};

export default nextConfig;
