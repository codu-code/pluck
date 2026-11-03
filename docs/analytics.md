# Analytics

Pluck uses PostHog (EU) on getpluck.io to see how people come to Pluck and whether they stay. A copy without `NEXT_PUBLIC_POSTHOG_KEY` (every self-hosted one, unless its owner sets it) sends nothing.

## Who is counted

- **Errors**, from the browser, the iPhone and the server, are sent for everyone, with no person: the error and where it happened.
- **Usage** is sent only for someone who said yes to the cookie question ("Pluck it, I'm in"). The answer belongs to the account (`settings.analytics`): the website's banner, the consent screen an AI tool opens and the iPhone's prompt all read and write it. Each answer carries when it was given (`settings.analyticsAt`), and the newest wins: a device takes the account's when that is newer and gives the account its own when that is, and the server ignores a save older than the answer it has, so a phone that was offline cannot undo a newer "Pluck off". An answer holds for a year; then every device asks again and the server counts nothing meanwhile. Why it lives on the account: [ADR 0001](adr/0001-analytics-consent-on-the-account.md).
- After "Pluck off", or before any answer, nothing about usage leaves, from any app or from the server.

## What is never sent

URLs, domains, titles, text, notes, tag and List names, search words, email addresses, or the arguments and results of an AI tool's calls. Events carry only the properties listed below (enums, counts, timings), and `apps/web/lib/telemetry.ts` drops anything else before it leaves. `telemetry.test.ts` checks this table against that list.

## The funnel

Visitor → `signed_up` → first `plucked` → `plucked` from a second surface (person property `plucked_from_*`) → `ai_tool_connected` → first `mcp_tool_called` → back in week 2 (a `plucked` or `mcp_tool_called` 7 to 14 days after `signed_up`).

## Server events

Sent from the server under the account's id, so they count the same whichever app the person used (the extension and email-in have no analytics of their own).

| Event | Properties | When |
|---|---|---|
| `signed_up` | `via` | When the account first says yes, dated when it was made. `via`: `try`, `mcp`, `public-page`, `shared-list`, `ios`, `extension` or `direct`, read off the sign-in request |
| `plucked` | `source`, `kind`, `re_pluck`, `count` | Any Pluck from any surface. One event per request, however many links; `kind` only when there was one |
| `ai_tool_connected` | `client_name` | The consent screen's yes to an AI tool (not to our own apps) |
| `ai_tool_disconnected` | `client_name` | Disconnect in Settings |
| `mcp_tool_called` | `tool`, `client_name`, `ok`, `error_code`, `result_count`, `duration_ms` | Every connector tool call. `client_name` is the name the AI tool registered with, or `api-key` |
| `mcp_prompt_used` | `prompt`, `client_name` | An AI tool fetched one of Pluck's prompts |
| `list_created` | `by` | `user` or `mcp` |
| `list_made_public` | | |
| `list_shared` | `people_count` | A new person added to a Shared List |
| `import_finished` | `import_source`, `total`, `failed` | |
| `highlight_made` | | |
| `item_opened` | `kind`, `preview` | |
| `searched` | `result_count` | Never the words |
| `api_key_created` | | |
| `email_in_used` | | |
| `handle_picked` | | |
| `export_requested` | | |
| `$set` | | Person properties only |

## Person properties

`via` and `signed_up_at` (set once), `plucked_from_<source>` (true once any Item came from it), `items_bucket` (`0`, `1-9`, `10-99`, `100+`), `ai_tools` (names of the tools connected now), `has_public_list`, `digest_on`, `locale`.

## In the browser and on the iPhone

After a yes, the browser sends pageviews and clicks with all text and attributes masked, page titles dropped, and URLs cut to their path and `utm_*` tags. The iPhone sends screen views (routes, never their content). Both identify the account with the same id the server uses, so a person's visits before sign-up join their account. No session recordings, surveys or feature flags.
