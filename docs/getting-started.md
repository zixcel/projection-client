# Using @hathq/projection-client

Adopt a validated display snapshot and keep updates tied to the correct revision.

## Before you start

The host supplies transport and trusted rendering. The client does not invent actions or canonical application state.

## First steps

Make the exact declared dependency artifacts available before installation. Local archives are excluded from Git; registry publication remains pending.

Run from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm test
```

## How to assess the result

- Reject stale or mismatched snapshots.
- Track navigation and interaction state across accepted updates.

A passing source-level check establishes only what that check observes. Keep missing configuration, unavailable services and unverified deployment paths visible.

## Continue reading

[Repository overview](../README.md)
