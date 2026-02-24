import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main id="main-content" role="main" tabIndex={-1} className="min-h-screen focus:outline-none">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
