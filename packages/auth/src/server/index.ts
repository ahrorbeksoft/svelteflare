import { defineSync } from "@svelteflare/sync";
import { getUserFromRequest, verifyJWT, getVerifiedUserFromRequest } from "../index.js";

export interface SyncAuthConfig {
  /**
   * Secret key used to verify the JWT tokens.
   */
  jwtSecret: string;
  /**
   * Name of the session cookie.
   * @default "sf_session"
   */
  cookieName?: string;
  /**
   * Optional database hook to verify if the user still exists or is active.
   */
  verifyUser?: (userId: string, ctx: any) => Promise<boolean>;
  /**
   * Optional database hook to persist user mutations.
   */
  onUpdate?: (userId: string, changes: any, ctx: any) => Promise<any>;
}

/**
 * Creates a Svelteflare Sync handler for WebSocket-based session validation.
 * Registers the read-only "users" channel.
 */
export function createAuthSync(config: SyncAuthConfig) {
  const cookieName = config.cookieName || "sf_session";

  return defineSync({
    channel: "users",

    // Runs automatically when the client queries/subscribes to the "users" channel
    authorize: async (ctx) => {
      const user = getUserFromRequest<{ id: string; token: string }>(ctx.request, cookieName);
      if (!user) {
        throw new Error("Unauthorized: No session cookie found");
      }

      // 1. Cryptographically verify the token
      let payload;
      try {
        payload = await verifyJWT(user.token, config.jwtSecret);
      } catch {
        throw new Error("Unauthorized: Invalid token");
      }

      // 2. Perform optional database validation (check if active/deleted)
      if (config.verifyUser) {
        const isValid = await config.verifyUser(payload.id, ctx);
        if (!isValid) {
          throw new Error("Unauthorized: User no longer exists");
        }
      }
    },

    // Returns the current session user so the client knows it is successfully authorized
    fetch: async (ctx) => {
      const user = getUserFromRequest(ctx.request, cookieName);
      return user ? [user] : [];
    },

    create: async () => {
      throw new Error("Forbidden: User creation is disabled on sync channel");
    },
    
    update: async (ctx, key, changes) => {
      // Verify token authenticity before allowing writes
      const user = await getVerifiedUserFromRequest<{ id: string; token: string }>(ctx.request, config.jwtSecret, cookieName);
      if (!user) {
        throw new Error("Unauthorized: Invalid session");
      }

      // Prevent users from updating other users' records
      if (user.id !== key) {
        throw new Error("Forbidden: Cannot modify other user profiles");
      }

      // Persist update via dev's DB hook if registered
      if (config.onUpdate) {
        return await config.onUpdate(key, changes, ctx);
      }

      // Fallback: return merged changes
      return { ...user, ...changes };
    },

    remove: async () => {
      throw new Error("Forbidden: User deletion is disabled on sync channel");
    }
  });
}
