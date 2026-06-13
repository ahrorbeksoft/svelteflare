import { createAuth } from "@svelteflare/auth/client";
import { sync } from "./sync-client.js";

export interface AppUser {
  id: string;
  email: string;
  name: string;
  token: string;
}

export const auth = createAuth<AppUser>({
  syncClient: sync,
});
