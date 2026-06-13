import { SyncClient } from "@svelteflare/sync/client";
import type { Todo } from "$lib/server/db/schema";

// Define the client-side database schema mapping table name to row type
type AppDatabaseSchema = {
  todos: Todo;
  users: {
    id: string;
    token: string;
    email: string;
    name: string;
  };
};

export const sync = new SyncClient<AppDatabaseSchema>({
  name: "svelteflare-sync",
  url: "/api/sync",
  tables: {
    todos: {
      indexes: "id, completed, createdAt",
      channel: "todos",
    },
    users: {
      indexes: "id",
      channel: "users",
    },
  },
});

// Autocompletes 'todos' and automatically returns typed table wrapper for Todo
export const todosTable = sync.table("todos");
