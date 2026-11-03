# Usage analytics wait for the account's own yes

Most of what shows whether Pluck works happens where no browser analytics can see it: a Pluck from the extension, the share sheet or email-in, an AI tool calling the connector. So those events are sent from the server. The privacy page promises that after "Pluck off" nothing about usage is sent, so the server has to know the answer. We store it on the account (`settings.analytics`), written by the web banner, the AI tool consent screen and the iPhone prompt. The server sends usage only when it is `yes`, and sends nothing while there is no answer.

## Considered options

- **Anonymous server counts for everyone.** Simpler, and with no person attached. It still breaks the "Pluck off" promise, and without a person there are no funnels.
- **Browser-only tracking.** Keeps consent in localStorage, but the extension, email-in and MCP stay invisible, and those are the parts of the funnel that matter most.

## Consequences

- People who never answer are never counted. Totals across everyone come from MongoDB (`pnpm numbers`), not PostHog.
- `signed_up` cannot be sent when the account is made, because the account has no answer yet. It is sent at the first yes, dated when the account began, with a uuid fixed by the account so PostHog keeps only one.
- Anything done before the first yes (often the first Pluck, made on `/try/claim` before the banner syncs) is not counted.
