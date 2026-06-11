import { SyncEngineBase } from "@svelteflare/sync/server";
import { handlers } from "./lib/server/sync-handlers.js";
import { getDB } from "$lib/server/db/index.js";
import { todos } from "$lib/server/db/schema.js";

export class SyncEngine extends SyncEngineBase {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env, handlers);
  }
}

export const scheduled: ExportedHandlerScheduledHandler<Env> = async (
  controller: ScheduledController,
  env: Env,
  ctx: ExecutionContext,
) => {
  console.log("Cron trigger: removing all todos...");
  const db = getDB({ env } as unknown as App.Platform);
  
  try {
    const allTodos = await db.select().from(todos);
    await db.delete(todos);
    
    const namespace = env.SYNC_ENGINE;
    if (namespace && allTodos.length > 0) {
      const id = namespace.idFromName("global");
      const stub = namespace.get(id);
      
      for (const todo of allTodos) {
        try {
          await stub.fetch("https://realtime.internal/broadcast", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              channel: "todos",
              action: "delete",
              key: todo.id,
              data: { updatedAt: new Date().toISOString() }
            }),
          });
        } catch (err) {
          console.error(`Failed to publish deletion for todo ${todo.id}:`, err);
        }
      }
    }
    
    console.log(`Cron trigger: successfully removed ${allTodos.length} todos.`);
  } catch (err) {
    console.error("Cron trigger failed:", err);
  }
};
