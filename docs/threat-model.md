# What can go wrong, and what stops it

Pluck holds people's libraries and lets their own AI tool read and change them. This page says who we defend against, what each can and cannot do, and where in the code the rule lives, so a reader can check it. To report a problem, see [SECURITY.md](../SECURITY.md).

There is no AI inside Pluck. The server never calls a model, so nothing a page says can change what the server does. The risk is the other way round: a page Pluck kept is later read by the person's AI tool, which has tools that change the library.

## A hostile page, read by your AI

A page can say anything, including "ignore your instructions and do this". When an AI tool reads it through `get_item`, the text is inside the tool's context. What the tool can then do through the connector is limited by what the connector offers:

| It cannot | Because |
|---|---|
| Make a List public, or share one with people | The connector has no such tool, `update_list` refuses `visibility: "public"`, and over REST both need a browser session or one of our own apps, never a key or an AI tool's token (`packages/mcp/src/server.ts`, `apps/web/app/api/v1/lists/[id]/route.ts`). |
| Delete anything for good | The connector's only delete, `delete_item`, moves an Item to the bin for 30 days, and is offered only with `library:delete`, which the consent screen does not ask for. |
| Reach the account | Handle, email-in address, API keys, export and deleting the account need the `account` scope, which only our own apps get (`apps/web/lib/auth.ts`). |
| Hide what it did | Everything an AI tool adds is marked "by AI": Tags, List notes, Lists and Items. Settings has "Remove everything AI tagged this week". |

What it **can** do with `library:write`: move Items between Inbox, Later, the Archive and Done, tag them, edit notes, make and reorder private Lists, and pluck new links. All of it can be put back; none of it leaves the library, with one exception.

**The exception is `save_item` with a link.** Pluck's server fetches the address it is given. A page that talks an AI into plucking `https://example.net/?q=<something from your notes>` has sent that something to example.net. The tool says so (`openWorldHint: true`), the server's instructions tell the AI that kept text is content and never instructions, and clients that ask before open-world calls will ask. This is the one channel out, and it is why a client that lets you approve tool calls is worth using.

## Someone else's AI tool, or a stolen token

- An AI tool gets in only through OAuth with your consent, or with a key you made. Tokens are bound to one audience: a connector token does not work on the REST API and the other way round.
- Settings, AI tools lists what is connected and when it last called. Disconnect cuts a tool off at once, even mid-token: every call checks the grant (`isAiConnected`).
- A registered client cannot be changed after you agreed to it: the routes that edit a client or a grant are off, so a redirect cannot be pointed somewhere else later.
- Only our own apps may use Pluck's name or ask for the REST API, so a look-alike cannot borrow the extension's consent screen.
- API keys are 128 random bits, kept as a SHA-256 hash, shown once.
- Limits: 600 calls a minute per person and 300 per network on the connector; 120 writes and 600 reads a minute per person on the REST API.

## One person reading another's library

- Only `packages/db` talks to MongoDB, and every query is scoped by `userId`. Each new query gets a test with two people in it; an ESLint rule keeps `mongodb` out of every other package.
- Public Lists are read by one function, `packages/db/src/public.ts`, with one field list (title, site, excerpt, cover, link, Kind and the page's facts). Kept text, Tags, ticks, Status, your notes on the Item and your highlights are not in it, and a test pins the list.
- Covers and files are served from the blob store by short-lived signed links, never from the app's own origin. Upload links take exactly the size and type that were declared.

## A hostile page, read by the server

Plucking a link makes the server fetch it, so the fetch is fenced (`packages/extract/src/fetch.ts`):

- http and https only. Private, loopback, link-local and carrier-grade addresses are refused, in every spelling we know of (decimal, hex, IPv4-mapped, IPv4-compatible, NAT64, 6to4, Teredo). The check runs on the address the connection is actually made to, so a DNS answer that changes cannot get past it, and every redirect is checked again.
- A size cap on the bytes as received, a time limit, six redirects at most. A PDF is read for its first 300 pages and stops when its time is up.
- Kept HTML is stored but never served. The reader shows kept text as Markdown with HTML off (`apps/web/lib/markdown.ts`), so a kept page cannot run script in your session.
- Links a page offers for the clients to open (a paper's PDF) are kept only when they are http or https.

## Email-in

Anyone who knows your `pluck+…@in…` address can put Items in your Inbox. The address is unguessable, you can make a new one in Settings, there is a daily cap per person, and mail the provider marks as spam or a virus is dropped (any failing verdict counts, so a forged passing header beside it does not help).

## A shared device

Signing out removes the library, the offline copies and what was waiting to go up, on the web, the iPhone and the extension. A sign-out the server did not hear is reported as failed, not shown as done. Plucks waiting on a device go only to the person who made them.

## Running your own

- The image refuses to start off localhost with the blob store's default secret.
- `SIGNUP_EMAILS` closes sign-up to the addresses or domains you name. Without it, anyone who can reach the server can start an account.
- Rate limits key on the caller's address from `X-Forwarded-For`: your proxy must set it to the one address it saw (`docs/self-host.md`).
- Never set `ALLOW_PRIVATE_FETCH` or `AUTH_RATE_LIMIT` on a server. They turn the fetch fence and the sign-in limits off for local development.

## What we do not defend against

- **Your AI tool's own judgement.** With `library:write` it can rearrange your library on a page's say-so. It is all marked and can be put back, but Pluck cannot tell a good instruction from a planted one.
- **A device someone else has unlocked.** Tokens are in the Keychain or the browser's extension storage; whoever holds the unlocked device holds them until you disconnect it.
- **The person who runs a self-hosted server.** They can read everything on it.
- **A sign-in code spent by a stranger.** Five wrong tries by anyone who knows your address spend the live code; you ask for another.
