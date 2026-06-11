/// <reference types="node" />

import { defineConfig } from "drizzle-kit";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const localD1Directory = "./.wrangler/state/v3/d1/miniflare-D1DatabaseObject";
const localD1Database = readdirSync(localD1Directory).find(
  (file) => file.endsWith(".sqlite") && file !== "metadata.sqlite",
);

if (!localD1Database) {
  throw new Error(
    "No local D1 database found. Run `bun run db:migrate:local` first.",
  );
}

export default defineConfig({
  schema: "./src/lib/server/db/schema.ts",
  out: "./drizzle/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: join(localD1Directory, localD1Database),
  },
});
