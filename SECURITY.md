# Security

Pluck holds people's libraries, so we take reports seriously and answer quickly.

## Reporting a problem

Please report it privately, never in a public issue:

- **GitHub:** [Report a vulnerability](https://github.com/codu-code/pluck/security/advisories/new) (a private advisory only the maintainers see), or
- **Email:** support@getpluck.io with "Security" in the subject.

Tell us what you found, how to see it, and what someone could do with it. A proof of concept against your own account or your own self-hosted copy is welcome; please do not touch other people's data, run denial-of-service tests, or test against getpluck.io beyond what it takes to show the problem.

## What happens next

- We reply within 3 working days to say we have it.
- We fix it, tell you when the fix is live, and credit you in the advisory if you would like.
- We ask that you keep it private until the fix is out, and we will not take legal action over research done in good faith within these lines.

## What is in scope

The hosted service at getpluck.io, the code in this repository (web app, API, MCP connector, browser extension, iPhone app and share extension, the Docker image), and the published `@getpluck/mcp` package.

Self-hosted copies are run by their owners; report problems in the code here, and the owner of that copy for problems in how it is run.

## Supported versions

Only the latest `main` is supported. getpluck.io deploys from it, and self-hosters update with `git pull && docker compose up -d --build`.
