import { json, route } from "@/lib/api";
import { aiToolsOf } from "@/lib/library";

// The AI tools connected over OAuth. Browser session only, like API keys.
export const GET = route({ kind: "read", scope: "full" }, async ({ caller }) => json({ tools: await aiToolsOf(caller.userId) }));
