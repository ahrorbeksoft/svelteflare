import { SyncEngineBase } from "@svelteflare/sync/server";
import { handlers } from "./lib/server/sync-handlers.js";

export class SyncEngine extends SyncEngineBase {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env, handlers);
  }
}

export const scheduled = undefined as any;
export const queue = undefined as any;
export const email = undefined as any;
export const tail = undefined as any;
