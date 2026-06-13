import { getUserFromCookie } from "@svelteflare/auth";
import type { AppUser } from "$lib/auth-client.js";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ cookies }) => {
  const user = getUserFromCookie<AppUser>(cookies);
  return { user };
};
