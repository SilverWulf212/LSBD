import type { Metadata } from "next";
import { Oswald, Roboto } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { SkipNav } from "@/components/layout/skip-nav";
import "./globals.css";

const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Louisiana State Board of Dentistry",
    template: "%s | Louisiana State Board of Dentistry",
  },
  description:
    "Protecting the public by regulating the professions of dentistry and dental hygiene in Louisiana in accordance with the Dental Practice Act.",
  metadataBase: new URL(process.env.AUTH_URL || "https://lsbd.org"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://lsbd.org",
    siteName: "Louisiana State Board of Dentistry",
    title: "Louisiana State Board of Dentistry",
    description:
      "Protecting the public by regulating the professions of dentistry and dental hygiene in Louisiana in accordance with the Dental Practice Act.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${oswald.variable} ${roboto.variable} font-sans antialiased`}
      >
        <SkipNav />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
