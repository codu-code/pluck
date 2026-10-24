import { oauthProviderAuthServerMetadata } from "@better-auth/oauth-provider";
import { auth } from "@/lib/auth";

// RFC 8414 authorization server metadata at the root (with and without the issuer path), for clients
// that look here rather than under /api/auth.
export const GET = oauthProviderAuthServerMetadata(auth);
