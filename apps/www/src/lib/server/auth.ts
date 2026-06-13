import { createServerAuth } from "@svelteflare/auth";
import { createAuthSync } from "@svelteflare/auth/server";

export let isUserBanned = false;

export function setBanned(val: boolean) {
  isUserBanned = val;
}

export const auth = createServerAuth({
  jwtSecret: "svelteflare-dummy-secret-key-12345",
  cookieName: "sf_session",
  cookieOptions: {
    maxAge: 60 * 60 * 24 * 7, // 1 week
    path: "/"
  }
});

export const authSync = createAuthSync({
  jwtSecret: "svelteflare-dummy-secret-key-12345",
  verifyUser: async (userId, ctx) => {
    if (isUserBanned) {
      return false;
    }
    return true;
  }
});
