import { requireMcpAuth } from "@better-auth/mcp";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { createPluckServer } from "@pluck/mcp-server";
import { hitRateLimit, isAiConnected, markMcpCall, verifyApiKey } from "@pluck/db";
import { after } from "next/server";
import { clientIp, type Caller } from "@/lib/api";
import { auth, MCP_RESOURCE } from "@/lib/auth";
import { connectorFor } from "@/lib/connector";
import { log } from "@/lib/log";

// The connector. Stateless: each HTTP request gets a fresh server bound to the caller, for both protocol eras.
const handler = createMcpHandler(({ authInfo }) => {
  const userId = String(authInfo?.extra?.userId);
  return createPluckServer(connectorFor(userId, { defer: after }), {
    scopes: authInfo?.scopes ?? [],
    onError: (error, tool) => log("error", "mcp tool error", { userId, tool, error: String(error) }),
  });
});

const PROTECTED_RESOURCE_METADATA = `${new URL(MCP_RESOURCE).origin}/.well-known/oauth-protected-resource/mcp`;

const rpcError = (status: number, message: string, headers?: HeadersInit) =>
  Response.json({ jsonrpc: "2.0", error: { code: -32000, message }, id: null }, { status, headers });

async function serve(req: Request, caller: Caller, clientId: string): Promise<Response> {
  const hit = await hitRateLimit(`user:${caller.userId}:mcp`, 600, 60);
  if (!hit.ok) return rpcError(429, "Too many requests. Try again shortly.", { "retry-after": String(hit.retryAfter) });
  after(() => markMcpCall(caller.userId));
  return handler.fetch(req, { authInfo: { token: "", clientId, scopes: caller.scopes, extra: { userId: caller.userId } } });
}

// OAuth access tokens: signature, issuer, audience (this endpoint) and expiry are checked against our own JWKS,
// and the person must not have disconnected the tool in Settings since the token was issued.
const viaOAuth = requireMcpAuth(
  auth,
  async (req, claims) => {
    const userId = String(claims.sub);
    const clientId = String(claims.azp);
    if (!(await isAiConnected(userId, clientId)))
      return rpcError(401, "This AI tool was disconnected. Connect it again to carry on.", { "www-authenticate": `Bearer resource_metadata="${PROTECTED_RESOURCE_METADATA}"` });
    return serve(req, { userId, scopes: String(claims.scope ?? "").split(" ").filter(Boolean) }, clientId);
  },
  { resource: MCP_RESOURCE },
);

async function mcp(req: Request): Promise<Response> {
  const ip = await hitRateLimit(`ip:${clientIp(req)}:mcp`, 300, 60);
  if (!ip.ok) return rpcError(429, "Too many requests. Try again shortly.", { "retry-after": String(ip.retryAfter) });
  // Personal API keys, for Claude Code, scripts and the stdio bridge.
  const bearer = req.headers.get("authorization")?.match(/^Bearer\s+(pk_live_\S+)$/i)?.[1];
  if (bearer) {
    const caller = await verifyApiKey(bearer);
    return caller ? serve(req, caller, "api-key") : rpcError(401, "That API key is not valid. Make a new one in Settings.");
  }
  return viaOAuth(req);
}

export { mcp as POST, mcp as GET, mcp as DELETE };
