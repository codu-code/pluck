import { auth } from "@/lib/auth";

// RFC 9728 protected resource metadata for /mcp, served by the mcp() plugin.
export const GET = (req: Request) => auth.handler(req);
