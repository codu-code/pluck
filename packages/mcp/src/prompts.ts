import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

// The AI features. The person's AI tool runs these; Pluck never calls a model.
const say = (text: string) => ({ messages: [{ role: "user" as const, content: { type: "text" as const, text } }] });

const ASK_FIRST =
  "Propose first and wait for my yes before you change anything. Use my existing tags; only suggest a new tag when none fits, and only call create_tag after I agree to its name.";

export function registerPrompts(server: McpServer, { canWrite }: { canWrite: boolean }) {
  const readOnly = canWrite ? "" : "\n\nThis connection can only read, so tell me the changes and I will make them in Pluck.";

  server.registerPrompt(
    "tidy_inbox",
    { title: "Tidy my inbox", description: "Go through the inbox and propose tags and a keep, later or archive call for each item." },
    () =>
      say(
        `Help me tidy my Pluck inbox.

1. Call list_items with status "inbox" (follow nextCursor until you have it all, or the first 100) and list_tags.
2. For each item, propose one or two tags from my existing tags, and one decision: keep in the inbox, move to later, or archive. Open an item with get_item only when the title and excerpt are not enough.
3. Show the proposal as a short table, grouped by decision. ${ASK_FIRST}
4. When I say yes (or yes with changes), apply it with batch_update, one call per decision and tag set. Then tell me what moved.${readOnly}`,
      ),
  );

  server.registerPrompt(
    "build_list",
    {
      title: "Build a list",
      description: "Gather what I plucked on a topic or in a time window into one or more ordered lists.",
      argsSchema: z.object({ topic: z.string().optional().describe("What the list is about."), window: z.string().optional().describe("A time window, like 'this month'.") }),
    },
    ({ topic, window }) =>
      say(
        `Build me a Pluck list${topic ? ` about ${topic}` : ""}${window ? ` from what I plucked ${window}` : ""}.

1. Find candidates with search_items${window ? " (use since for the window)" : ""} and list_items, and read the strongest with get_item.
2. Propose one list, or a few if the items fall into clear groups: a name, a one-line purpose, the items in a sensible order, and a short line on why each is there.
3. ${ASK_FIRST}
4. When I agree, make each list with create_list. Lists start private; leave them that way unless I ask.${readOnly}`,
      ),
  );

  server.registerPrompt(
    "content_ideas",
    {
      title: "Content ideas",
      description: "Read the strongest items on a topic and draft three angles, with sources, in my voice.",
      argsSchema: z.object({ topic: z.string().describe("What to write about."), window: z.string().optional().describe("A time window, like 'the last 3 months'.") }),
    },
    ({ topic, window }) =>
      say(
        `I want to write about ${topic}. Use what I plucked${window ? ` ${window}` : ""} as the source material.

1. Search my library with search_items and read the five to ten strongest items in full with get_item (follow textCursor for long ones). Use my notes and highlights; they show what I thought mattered.
2. Draft three different angles. For each: a working title, three or four sentences in my voice, and the items it draws on (title and link).
3. Then offer two things, and do them only if I say yes: a private list of the sources with create_list, and saving the angle I pick as a Note with save_item.${readOnly}`,
      ),
  );

  server.registerPrompt(
    "weekly_review",
    { title: "Weekly review", description: "Walk through what is expiring, due, oldest in the inbox and quiet lists, one decision at a time." },
    () =>
      say(
        `Run my weekly Pluck review.

1. Call get_digest.
2. Go through it one decision at a time, in this order: items about to expire (keep, later or let go), todos that are due (done, new date, or drop), the oldest inbox items, then lists that have gone quiet (pick up, or archive the finished items).
3. Ask about one thing at a time and wait for my answer. Apply each answer straight away with batch_update or update_list, then move to the next.
4. End with a two-line summary of what changed.${readOnly}`,
      ),
  );
}
