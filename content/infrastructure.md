# Infrastructure handbook

Set up, secure, test, and operate the Heretical development suite. This view uses
Doxygen's source aggregation and search to provide a wiki-style guide while every
article remains maintained in its owning repository.

## First clone

1. **[Choose a scale](workspace/docs/guides/infrastructure/scale-selection.md)**:
   desktop for one developer, homelab for a trusted private network, or distributed
   for separate hosts/trust zones.
2. **[Desktop quick start](workspace/docs/guides/infrastructure/desktop-quickstart.md)**:
   prepare ignored configuration and local secrets, understand your GitHub admin
   username and private address, and request OAuth approval where necessary.
3. **[Credentials and access](workspace/docs/guides/infrastructure/credentials-and-access.md)**:
   distinguish usernames, OAuth client credentials, agent tokens, PATs, Kan
   invitations, and ntfy identities.
4. **[Woodpecker quick start](workspace/docs/guides/infrastructure/woodpecker-quickstart.md)**:
   activate repositories, disable webhooks, register the organization agent, and
   run the first real pipeline.

## Common questions, answered

- “OAuth authorized, but there are no repositories?” →
  [OAuth and repository access](workspace/docs/guides/infrastructure/troubleshooting.md#no-repositories-after-oauth).
- “Is `WOODPECKER_ADMIN` a PAT?” →
  [Credential types](workspace/docs/guides/infrastructure/credentials-and-access.md).
- “Which private address should I use?” →
  [Private webhook registration address](workspace/docs/guides/infrastructure/desktop-quickstart.md).
- “How do I disable a webhook?” →
  [Activate repositories and disable webhooks](workspace/docs/guides/infrastructure/woodpecker-quickstart.md).
- “Why is Agents missing?” →
  [Agent troubleshooting](workspace/docs/guides/infrastructure/troubleshooting.md).
- “Why is my agent healthy but unable to receive jobs?” →
  [Personal versus organization agents](workspace/docs/guides/infrastructure/woodpecker-quickstart.md).
- “Why did my pipeline use the old commands?” →
  [Branch, SHA, and rerun behavior](workspace/docs/guides/infrastructure/troubleshooting.md).

## Daily use and product builds

- [Daily operations](workspace/docs/guides/infrastructure/daily-operations.md):
  startup, shutdown, status, logs, testing, backups, and exports.
- [Add a product pipeline](workspace/docs/guides/infrastructure/product-pipelines.md):
  compile, test, package, and back up deliberately activated products.
- [Backups and recovery](workspace/docs/guides/infrastructure/backup-and-recovery.md):
  verified archives, isolated restores, and protected storage.
- [Troubleshooting](workspace/docs/guides/infrastructure/troubleshooting.md):
  symptom → cause → smallest corrective action.

## By tool

- [Kan quick start](workspace/docs/guides/infrastructure/kan-quickstart.md)
- [ntfy quick start](workspace/docs/guides/infrastructure/ntfy-quickstart.md)
- [Homelab guide](workspace/docs/guides/infrastructure/homelab.md)
- [Distributed guide](workspace/docs/guides/infrastructure/distributed.md)

## Reference by topic

| Topic | Reference |
|---|---|
| Infrastructure index | [By tool and scale](workspace/infrastructure/overview.md) |
| Scale orchestration | [Suite commands](workspace/infrastructure/suite/overview.md) |
| Desktop architecture | [Desktop profile](workspace/infrastructure/suite/scales/desktop.md) |
| Homelab architecture | [Homelab profile](workspace/infrastructure/suite/scales/homelab.md) |
| Distributed architecture | [Distributed profile](workspace/infrastructure/suite/scales/distributed.md) |
| CI server and agent | [Woodpecker deployment](workspace/infrastructure/woodpecker/overview.md) |
| CI operations | [Woodpecker operations](workspace/infrastructure/woodpecker/docs/operations.md) |
| Planning service | [Kan deployment](workspace/infrastructure/kan/overview.md) |
| Planning conventions | [Board conventions](workspace/infrastructure/kan/docs/board-conventions.md) |
| Planning operations | [Kan operations](workspace/infrastructure/kan/docs/operations.md) |
| Planning agent access | [Kan MCP setup](workspace/infrastructure/kan/docs/mcp.md) |
| Notification service | [ntfy deployment](workspace/infrastructure/ntfy/overview.md) |
| Notification identities | [ntfy clients](workspace/infrastructure/ntfy/docs/clients.md) |
| Notification operations | [ntfy operations](workspace/infrastructure/ntfy/docs/operations.md) |
| Archive registry and export | [Shared backup helpers](workspace/infrastructure/backup/overview.md) |
| Service policies | [Kan policy](workspace/docs/infrastructure/kan.md), [ntfy policy](workspace/docs/infrastructure/ntfy.md), [Woodpecker policy](workspace/docs/infrastructure/woodpecker.md) |
