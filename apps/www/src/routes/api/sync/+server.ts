import { handleUpgrade } from "@svelteflare/sync";
import type { RequestEvent, RequestHandler } from "@sveltejs/kit";

export const GET: RequestHandler = (event: RequestEvent) => {
  return handleUpgrade(event.request, event.platform);
};
