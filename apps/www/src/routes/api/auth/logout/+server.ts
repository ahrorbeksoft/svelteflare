import { auth } from "$lib/server/auth";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ cookies }) => {
  auth.logout(cookies);
  return json({ success: true });
};
