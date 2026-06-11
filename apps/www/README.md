# Svelteflare Showcase App

This is a showcase Todo application built with **Svelte 5** and **SvelteKit**, demonstrating the use of the `@svelteflare/sync` package for real-time, local-first database replication.

It uses **IndexedDB (via Dexie.js)** on the client for instant local persistence and optimistic UI updates, and replicates changes reactively over a multiplexed WebSocket connection to a **Cloudflare Durable Object** paired with **Cloudflare D1** on the server.

## Features Demonstrated

1. **Local-First Speed**: Actions like creating, toggling, or deleting todos are committed to the local database immediately (~1ms) and update the UI instantly using Svelte 5 runes.
2. **Reconnection Resilience**: If the user goes offline, mutations are queued up locally and synced automatically when the connection is restored.
3. **Hibernate-Friendly DO (Cost-Saver 1)**: Sync heartbeats are client-initiated (every 55s), enabling the Durable Object to hibernate when idle to minimize active execution charges.
4. **Zero-Config Dev Server**: A custom Vite plugin spins up a local WebSocket mock server during development, using a local SQLite file to emulate Cloudflare D1 so that you don't even need Wrangler running.

## Getting Started

### 1. Install Dependencies

Run from the monorepo root:

```bash
bun install
```

### 2. Local Development (Zero-Config)

To start the SvelteKit application in development mode with the local mock sync server:

```bash
bun run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser. This mode uses a local SQLite fallback database and a simulated WebSocket server managed by the Vite plugin (`syncDevPlugin`).

### 3. Running with Full Cloudflare Emulation (Wrangler)

To run the app locally using Wrangler to emulate D1 and Durable Objects:

1. **Apply D1 Database Migrations locally**:
   ```bash
   bun run db:migrate:local
   ```
2. **Build and start Wrangler**:
   ```bash
   bun run preview
   ```
   This will compile the SvelteKit app, build the Durable Object worker bindings, and run `wrangler dev` on port 4173.

## Database & Schema Management

The app uses **Drizzle ORM** to manage the D1 schema.

- **Generate Schema Migrations**:
  ```bash
  bun run db:generate
  ```
- **Apply Migrations to Local D1**:
  ```bash
  bun run db:migrate:local
  ```
- **Open Drizzle Studio (Local Database GUI)**:
  ```bash
  bun run db:studio:local
  ```
