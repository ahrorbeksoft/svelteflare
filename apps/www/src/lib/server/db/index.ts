import { drizzle as d1Drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export const createDB = (database: D1Database) =>
  d1Drizzle(database, { schema });

export function getDB(platform: App.Platform | undefined) {
  if (platform?.env.DB) {
    return createDB(platform.env.DB);
  }
  throw new Error("D1 Database binding 'DB' is not available in platform.env");
}
