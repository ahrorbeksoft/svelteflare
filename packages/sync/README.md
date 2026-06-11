# @svelteflare/sync

Reactive, local-first database synchronization library built for **Svelte 5** and **Cloudflare Workers / Durable Objects**.

## Features

- **Local Persistence**: Powered by Dexie.js (IndexedDB). Zero-WASM, instant load times, persistent across page refreshes.
- **Optimistic Updates**: Client mutations update the local database instantly (~1ms), sync with the server in the background, and roll back automatically on failures.
- **Real-Time Sync**: Single multiplexed WebSocket connection fanning out updates to all active subscribers.
- **Last-Write-Wins (LWW)**: Timestamps prevent out-of-order write conflicts.
- **Delta Syncing (Incremental Load)**: Automatically pulls only modified records since the last sync time to conserve network bandwidth.
- **Hibernate Friendly**: Client-initiated heartbeats allow Cloudflare Durable Objects to sleep when idle, cutting active execution costs down to near zero.

## Installation

```bash
npm install @svelteflare/sync dexie
```

## Quick Start

### 1. Client Configuration

Declare your database schema type and instantiate `SyncClient`:

```typescript
// src/lib/sync.ts
import { SyncClient } from '@svelteflare/sync/client';
import type { Todo } from './schema';

type AppSchema = {
  todos: Todo;
};

export const sync = new SyncClient<AppSchema>({
  name: 'my-app',
  url: '/api/sync',
  tables: {
    todos: {
      indexes: 'id, completed, createdAt', // Dexie indexes
      channel: 'todos'
    }
  }
});

export const todosTable = sync.table('todos');
```

Use in Svelte components reactively:

```svelte
<script lang="ts">
  import { todosTable } from '$lib/sync';

  // Reactive liveQuery auto-updates on local/remote updates
  const todos = todosTable.liveQuery(t => t.orderBy('createdAt').toArray());
</script>

{#each todos.current ?? [] as todo}
  <div>{todo.title}</div>
{/each}
```

### 2. Server Configuration

Define a sync handler for the `todos` channel:

```typescript
// src/lib/server/sync.ts
import { defineSync } from '@svelteflare/sync';

export const todoSync = defineSync<Todo>({
  channel: 'todos',
  fetch: async (ctx, since) => {
    return since 
      ? db.select().from(todos).where(gt(todos.updatedAt, since))
      : db.select().from(todos);
  },
  create: async (ctx, data) => {
    const [row] = await db.insert(todos).values(data).onConflictDoUpdate(...).returning();
    return row;
  },
  update: async (ctx, key, changes) => {
    const [row] = await db.update(todos).set(changes).where(eq(todos.id, key)).returning();
    return row;
  },
  remove: async (ctx, key) => {
    await db.delete(todos).where(eq(todos.id, key));
  }
});
```

Subclass the Durable Object class inside your SvelteKit Cloudflare platform entrypoint:

```typescript
// src/platform.cloudflare.ts
import { SyncEngineBase } from '@svelteflare/sync/server';
import { handlers } from './server/sync';

export class SyncEngine extends SyncEngineBase {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env, handlers);
  }
}
```
