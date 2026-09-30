// Next 16 "proxy" (formerly middleware) runs on the Node.js runtime, which the
// auth import chain needs (node-postgres uses Node's crypto/net).
export { auth as proxy } from "@/lib/auth";

export const config = {
  matcher: ["/admin/:path*"],
};
