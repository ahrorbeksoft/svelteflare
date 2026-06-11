# Svelteflare Workspace

A monorepo containing Svelte + Cloudflare integrations.

## Packages

- **`@svelteflare/sync`** (`packages/sync`): Reactive, local-first database synchronization library using Dexie.js (IndexedDB) on the client, WebSocket multiplexing, and Cloudflare Durable Objects on the server.

## Apps

- **`www`** (`apps/www`): Showcase SvelteKit application displaying reactive todos synced to Cloudflare D1.

## Getting Started

To install dependencies:

```bash
bun install
```

To build all packages:

```bash
bun run build
```

To run type checks across all packages:

```bash
bun run check
```

## Release

To bump the version of all packages:

```bash
bun run release:version <patch|minor|major|x.y.z>
```

To publish packages to npm:

```bash
bun run release:publish
```
