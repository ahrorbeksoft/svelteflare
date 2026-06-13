import { auth } from "$lib/server/auth.js";
import { getUserFromCookie } from "@svelteflare/auth";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async (event) => {
  const { cookies, request } = event;
  
  // 1. Retrieve the existing user session
  const currentUser = getUserFromCookie<any>(cookies);
  if (!currentUser) {
    return new Response("Unauthorized", { status: 401 });
  }

  // 2. Parse profile changes and merge them
  const changes = (await request.json()) as Record<string, any>;
  const updatedUser = { ...currentUser, ...changes };

  // Remove the old token to let auth.login generate a new verified token
  const { token, ...payloadWithoutToken } = updatedUser;

  // 3. Save the new session cookie with updated details
  const sessionUser = await auth.login(cookies, payloadWithoutToken);

  return json({ success: true, user: sessionUser });
};
