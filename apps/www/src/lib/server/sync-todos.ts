import { defineSync } from "@svelteflare/sync";
import { getDB } from "$lib/server/db/index.js";
import { todos } from "$lib/server/db/schema";
import { desc, eq, gt } from "drizzle-orm";
import type { Todo } from "$lib/server/db/schema";
import type { SyncContext } from "@svelteflare/sync";

export const todoSync = defineSync<Todo>({
  channel: "todos",

  fetch: async (ctx: SyncContext, since?: string) => {
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

  create: async (ctx: SyncContext, data: Todo) => {
    const db = getDB(ctx.platform);
    const [created] = await db
      .insert(todos)
      .values({
        id: data.id,
        title: data.title,
        completed: data.completed || false,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: todos.id,
        set: {
          title: data.title,
          completed: data.completed || false,
          updatedAt: data.updatedAt || new Date().toISOString(),
        },
      })
      .returning();
    return created;
  },

  update: async (ctx: SyncContext, key: string, changes: Partial<Todo>) => {
    const db = getDB(ctx.platform);
    const [updated] = await db
      .update(todos)
      .set({
        ...changes,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(todos.id, key))
      .returning();
    return updated;
  },

  remove: async (ctx: SyncContext, key: string) => {
    const db = getDB(ctx.platform);
    await db.delete(todos).where(eq(todos.id, key));
  },
});
