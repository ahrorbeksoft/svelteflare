import { SyncEngineBase } from "@svelteflare/sync/server";
import { handlers } from "./lib/server/sync-handlers.js";

export class SyncEngine extends SyncEngineBase {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env, handlers);
  }
}
