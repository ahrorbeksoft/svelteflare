import tailwindcss from "@tailwindcss/vite";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import { syncDevPlugin } from "@svelteflare/sync/vite";

export default defineConfig({
  plugins: [tailwindcss(), syncDevPlugin(), sveltekit()],
  ssr: {
    external: ["cloudflare:workers"],
  },
});
