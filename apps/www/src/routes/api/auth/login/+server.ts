import { auth } from "$lib/server/auth";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ cookies }) => {
  const dummyUser = {
    id: "user_dummy_99",
    email: "dummy@svelteflare.dev",
    name: "Dummy Tester"
  };

  const sessionUser = await auth.login(cookies, dummyUser);

  return json({ success: true, user: sessionUser });
};
