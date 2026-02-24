export function SkipNav() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-white focus:text-[#005f8f] focus:ring-2 focus:ring-[#0077B6] focus:rounded-md focus:shadow-lg focus:outline-none focus:font-semibold focus:text-sm"
    >
      Skip to main content
    </a>
  );
}
