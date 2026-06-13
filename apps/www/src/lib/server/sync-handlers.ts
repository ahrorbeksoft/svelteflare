import { todoSync } from "./sync-todos.js";
import { authSync } from "./auth.js";

export const handlers = [authSync, todoSync];
