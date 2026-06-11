# @svelteflare/sync

Reactive, local-first database synchronization library built for **Svelte 5** and **Cloudflare Workers / Durable Objects**.

## Features

- **Local Persistence**: Powered by [Dexie.js](https://dexie.org/) (IndexedDB). Zero-WASM, instant load times, persistent across page refreshes.
- **Optimistic Updates**: Client mutations update the local database instantly (~1ms), sync with the server in the background, and roll back automatically on failures.
- **Real-Time Sync**: Single multiplexed WebSocket connection fanning out updates to all active subscribers.
- **Last-Write-Wins (LWW)**: Timestamps prevent out-of-order write conflicts.
- **Delta Syncing (Incremental Load)**: Automatically pulls only modified records since the last sync time to conserve network bandwidth.
- **Hibernate Friendly**: Client-initiated heartbeats allow Cloudflare Durable Objects to sleep when idle, cutting active execution costs down to near zero.
- **Vite Integration**: Custom dev plugin simulating Durable Objects and bindings proxy locally without full worker compilation loops.

---

## Architecture & Forked Adapter

To bind custom Cloudflare Workers features (like **Durable Objects**, **Queues**, and **Email Handlers**) directly within a SvelteKit application, you **must use** the forked adapter:

👉 **`@joshthomas/sveltekit-adapter-cloudflare`**

### Why this adapter?
The official `@sveltejs/adapter-cloudflare` owns the final worker entrypoint (`_worker.js`) and does not natively allow you to declare custom class exports (like Durable Objects) in the same worker. 

The **Josh Thomas fork** introduces a platform entrypoint (`src/platform.cloudflare.ts`) which SvelteKit bundles into the worker wrapper, allowing you to export Durable Objects while SvelteKit continues to manage Svelte routing and page rendering.

---

## 1. Cloudflare Configuration (`wrangler.jsonc`)

Define D1 database and Durable Object namespace configurations in your `wrangler.jsonc` (or `wrangler.toml`):

```json
{
  "compatibility_date": "2026-06-07",
  "compatibility_flags": ["nodejs_compat"],
  "main": ".svelte-kit/cloudflare/_worker.js",
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "svelteflare-sync",
      "database_id": "YOUR_DATABASE_ID",
      "migrations_dir": "drizzle/migrations"
    }
  ],
  "durable_objects": {
    "bindings": [
      {
        "name": "SYNC_ENGINE",
        "class_name": "SyncEngine"
      }
    ]
  },
  "migrations": [
    {
      "tag": "v1",
      "new_sqlite_classes": ["SyncEngine"]
    }
  ]
}
```

---

## 2. Setup Guide

### Step 1: Client Schema & Client Creation

Configure your client-side IndexedDB database using `SyncClient`.

```typescript
// src/lib/sync-client.ts
import { SyncClient } from "@svelteflare/sync/client";
import type { Todo } from "$lib/server/db/schema";

// Map table name to row type
type AppDatabaseSchema = {
  todos: Todo;
};

export const sync = new SyncClient<AppDatabaseSchema>({
  name: "svelteflare-sync", // Local IndexedDB name
  url: "/api/sync",         // WebSocket endpoint
  tables: {
    todos: {
      indexes: "id, completed, createdAt", // IndexedDB indexes
      channel: "todos",                     // Sync channel
    },
  },
});

// Export typed table wrapper
export const todosTable = sync.table("todos");
```

Use it in your Svelte 5 components:
```svelte
<script lang="ts">
  import { todosTable } from "$lib/sync-client";
  import { Check, Trash } from "lucide-svelte";

  // Reactive liveQuery updates instantly on local mutations & remote syncs
  const todos = todosTable.liveQuery((t) => t.orderBy("createdAt").reverse().toArray());

  let title = "";

  async function addTodo() {
    if (!title.trim()) return;
    await todosTable.add({
      id: crypto.randomUUID(),
      title,
      completed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    title = "";
  }
</script>

<input bind:value={title} onkeydown={(e) => e.key === 'Enter' && addTodo()} />

{#each todos.current ?? [] as todo (todo.id)}
  <div>
    <button onclick={() => todosTable.put(todo.id, { completed: !todo.completed })}>
      <Check class={todo.completed ? "text-emerald-500" : ""} />
    </button>
    <span>{todo.title}</span>
    <button onclick={() => todosTable.delete(todo.id)}><Trash /></button>
  </div>
{/each}
```

---

### Step 2: Define Sync Handlers (Server)

Define the handlers that translate IndexedDB operations (fetch, create, update, delete) to D1 database queries:

```typescript
// src/lib/server/sync-todos.ts
import { defineSync } from "@svelteflare/sync";
import { getDB } from "$lib/server/db/index.js";
import { todos } from "$lib/server/db/schema";
import { desc, eq, gt } from "drizzle-orm";
import type { Todo } from "$lib/server/db/schema";

export const todoSync = defineSync<Todo>({
  channel: "todos",

  fetch: async (ctx, since) => {
    const db = getDB(ctx.platform);
    if (since) {
      return await db
        .select()
        .from(todos)
        .where(gt(todos.updatedAt, since))
        .orderBy(desc(todos.createdAt));
    }
    return await db.select().from(todos).orderBy(desc(todos.createdAt));
  },

  create: async (ctx, data) => {
    const db = getDB(ctx.platform);
    const [created] = await db
      .insert(todos)
      .values(data)
      .onConflictDoUpdate({
        target: todos.id,
        set: {
          title: data.title,
          completed: data.completed,
          updatedAt: new Date().toISOString(),
        },
      })
      .returning();
    return created;
  },

  update: async (ctx, key, changes) => {
    const db = getDB(ctx.platform);
    const [updated] = await db
      .update(todos)
      .set({ ...changes, updatedAt: new Date().toISOString() })
      .where(eq(todos.id, key))
      .returning();
    return updated;
  },

  remove: async (ctx, key) => {
    const db = getDB(ctx.platform);
    await db.delete(todos).where(eq(todos.id, key));
  },
});
```

Export handlers from a single list:
```typescript
// src/lib/server/sync-handlers.ts
import { todoSync } from "./sync-todos.js";

export const handlers = [todoSync];
```

---

### Step 3: SvelteKit WebSocket Server Route

Set up the upgrade endpoint to forward SvelteKit HTTP upgrades to Durable Objects.

```typescript
// src/routes/api/sync/+server.ts
import { handleUpgrade } from "@svelteflare/sync";
import type { RequestEvent, RequestHandler } from "@sveltejs/kit";

export const GET: RequestHandler = (event: RequestEvent) => {
  return handleUpgrade(event.request, event.platform);
};
```

---

### Step 4: Svelte Config & Cloudflare Platform Entrypoint

Configure `@joshthomas/sveltekit-adapter-cloudflare` in your `svelte.config.js`:

```javascript
// svelte.config.js
import adapter from "@joshthomas/sveltekit-adapter-cloudflare";

export default {
  kit: {
    adapter: adapter({
      platform: "src/platform.cloudflare.ts" // Platform config file
    })
  }
};
```

Create `src/platform.cloudflare.ts` to export your Durable Object `SyncEngine` class:

```typescript
// src/platform.cloudflare.ts
import { SyncEngineBase } from "@svelteflare/sync/server";
import { handlers } from "./lib/server/sync-handlers.js";

// Export the Durable Object class compiled into the worker
export class SyncEngine extends SyncEngineBase {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env, handlers);
  }
}
```

---

### Step 5: Vite Dev Plugin Setup

In Vite development mode, Durable Objects are not natively available. We provide a Vite plugin (`syncDevPlugin`) that intercepts upgrades and emulates the DO synchronization broker locally in Node.js.

Configure `vite.config.ts`:

```typescript
// vite.config.ts
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import { syncDevPlugin } from "@svelteflare/sync/vite";

export default defineConfig({
  plugins: [
    syncDevPlugin({
      // Path to your sync handlers. Uses ssrLoadModule so SvelteKit 
      // path aliases (like $lib) resolve perfectly at runtime.
      handlersPath: "$lib/server/sync-handlers" 
    }),
    sveltekit()
  ]
});
```

---

## 3. Local Development Features

### Automatic Bindings Proxy
During development (`vite dev`), the dev engine uses Wrangler's programmatic Node API `getPlatformProxy()` under the hood. It caches the proxy on `globalThis` to survive Vite HMR reloads. 

Both SvelteKit and the dev WebSocket server share the **exact same emulated D1 database instance** automatically.

### Message Buffering
Vite's module loading is asynchronous. When upgrading WebSocket connections, the plugin buffers incoming WebSocket frames during the module import phase. Once modules have fully loaded and handlers are registered, it replays the buffered messages to avoid connection race conditions.
