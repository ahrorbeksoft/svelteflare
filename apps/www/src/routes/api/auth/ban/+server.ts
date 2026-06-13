import { setBanned } from "$lib/server/auth.js";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request }) => {
  const { banned } = (await request.json()) as { banned?: boolean };
  setBanned(!!banned);
  return json({ success: true, banned: !!banned });
};
