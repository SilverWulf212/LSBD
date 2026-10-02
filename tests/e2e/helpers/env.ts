// Where the suite points. Production by default; override with E2E_BASE_URL.
export const E2E_BASE_URL = (process.env.E2E_BASE_URL || "https://lsbd-sigma.vercel.app").replace(/\/+$/, "");
