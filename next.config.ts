import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
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
        ],
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
    ];
  },
};

export default nextConfig;
