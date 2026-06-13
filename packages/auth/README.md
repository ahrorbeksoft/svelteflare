# @svelteflare/auth

A lightweight, Edge-native, DB-agnostic authentication library built for **Svelte 5** and **SvelteKit** that integrates seamlessly with **@svelteflare/sync** for real-time WebSocket session verification.

## Features

- **Stateless JWT Sessions**: Session data is signed using HMAC-SHA256 and stored directly in secure, server-side `HttpOnly` cookies.
- **DB-Agnostic Design**: Works out-of-the-box with D1 SQLite, Drizzle, Prisma, Postgres, or any other database of your choice.
- **Fast, Database-Free SSR**: Page renders decode the signed cookie instantly without database queries or heavy cryptographic signature validation on initial loads.
- **Svelte 5 Reactive Getters**: Hydrate client state with a reactive getter function (`() => data.user`) so that the UI reactively updates without writing `$effect` sync boilerplate in layouts.
- **WebSocket Channel Verification**: Offloads token verification and database checkups to Svelteflare Sync's WebSocket connection, verifying credentials in the background.
- **Automatic Offline Cache Wiping**: Automatically cleans up local IndexedDB database tables and terminates WebSocket connections on session expiry, account deletion, or user logout.
- **Web Crypto API Native**: Built on top of `globalThis.crypto.subtle` (zero NPM dependencies) to run at maximum speed in Edge runtimes like Cloudflare Workers.

---

## Architecture & Flows

### 1. Fast Page Load (SSR)
```
Browser (Client) ------------[ GET /dashboard ]------------> SvelteKit Server (SSR)
                                                                    │
                                                           getUserFromCookie()
                                                           (Fast JSON base64-decode)
                                                                    │
Browser (Client) <-----------[ HTML + page.data ]───────────────────┘
```
SSR is instant because no database queries or cryptographic signature verifications are performed during the page load.

### 2. WebSocket Background Verification
```
Browser (Client) ────────────[ Connect WebSocket ]───────────> Sync Engine (DO)
       │                                                             │
       ├───────────────[ Subscribe: "users" channel ]───────────────>┤
       │                                                             │
       │                                                        verifyJWT()
       │                                                        (Crypto verification)
       │                                                             │
       │                                                        verifyUser()
       │                                                        (Database check)
       │                                                             │
       │<──────────────[ Subscription Authorized ]───────────────────┤ (Success)
       │                                                             │
       │<──────────────[ Subscription Error ]────────────────────────┘ (Fail)
       │
       ▼ (If failed)
  auth.logout() 
  (Wipes IndexedDB & redirects)
```

---

## 1. Installation

Add the package to your SvelteKit project workspace:
```bash
bun add @svelteflare/auth
```

---

## 2. Server Setup

Configure the server-side authentication manager:

```typescript
// src/lib/server/auth.ts
import { createServerAuth } from "@svelteflare/auth";
import { JWT_SECRET } from "$env/static/private";

export interface AppUser {
  id: string;
  email: string;
  name: string;
  token: string; // Embedded JWT signature
}

export const auth = createServerAuth<AppUser>({
  jwtSecret: JWT_SECRET,
  cookieName: "sf_session",
  cookieOptions: {
    maxAge: 60 * 60 * 24 * 7, // 1 week
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "lax"
  }
});
```

---

## 3. SvelteKit Route Integration

### Server load (`src/routes/+layout.server.ts`)
Retrieve the user payload from the cookies during page render:

```typescript
import { getUserFromCookie } from "@svelteflare/auth";
import type { AppUser } from "$lib/auth-client.js";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ cookies }) => {
  // Sub-millisecond unverified JSON decode
  const user = getUserFromCookie<AppUser>(cookies);
  return { user };
};
```

### Server endpoints (`src/routes/api/auth/login/+server.ts`)
Set the session cookie upon credentials verification:

```typescript
import { auth } from "$lib/server/auth.js";
import { json } from "@sveltejs/kit";

export const POST = async ({ cookies, request }) => {
  const credentials = await request.json();
  
  // 1. Verify credentials with your database
  const dbUser = await verifyCredentials(credentials);
  if (!dbUser) {
    return new Response("Invalid credentials", { status: 401 });
  }

  // 2. setSession creates the JWT, embeds it in user.token, and writes the cookie
  const sessionUser = await auth.login(cookies, {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name
  });

  return json({ success: true, user: sessionUser });
};
```

---

## 4. Client Setup (Svelte 5)

Initialize the client auth state, linking it to your `@svelteflare/sync` client:

```typescript
// src/lib/auth-client.ts
import { createAuth } from "@svelteflare/auth/client";
import { sync } from "./sync-client.js"; // your Svelteflare Sync instance
import type { AppUser } from "./server/auth.js";

export const auth = createAuth<AppUser>({
  syncClient: sync // Handles automated channel monitoring & auto-logouts
});
```

### Layout Binding (`src/routes/+layout.svelte`)
Initialize the state once using a Svelte 5 reactive getter:

```svelte
<script lang="ts">
  import { auth } from "$lib/auth-client";
  let { data, children } = $props();

  // Initialize once. It automatically tracks changes to data.user
  auth.init(() => data.user);
</script>

{@render children()}
```

---

## 5. WebSocket Sync Verification (Post-Load Security)

To run background cryptographic and database checks, register the `createAuthSync` handler on your sync server:

```typescript
// src/lib/server/sync-handlers.ts
import { createAuthSync } from "@svelteflare/auth/server";
import { JWT_SECRET } from "$env/static/private";
import { getDB } from "./db.js";

export const handlers = [
  createAuthSync({
    jwtSecret: JWT_SECRET,
    // Database check to verify if the user account is active/valid
    verifyUser: async (user, ctx) => {
      const db = getDB(ctx.platform);
      const activeUser = await db.select().from(users).where(eq(users.id, user.id)).get();
      return !!activeUser && !activeUser.isSuspended;
    },
    // Optional persistence hook for user mutations (e.g. auth.update)
    onUpdate: async (userId, changes, ctx) => {
      const db = getDB(ctx.platform);
      return await db.update(users).set(changes).where(eq(users.id, userId)).returning();
    }
  }),
  todoSync
];
```

---

## 6. API Reference

### Server APIs (`@svelteflare/auth`)

* **`createServerAuth<User>(config: AuthConfig)`**
  Creates cookie management helpers.
  * `login(cookies: Cookies, userPayload: Omit<User, 'token'>, options?): Promise<User>`: Encodes and writes session to cookie.
  * `logout(cookies: Cookies, options?): void`: Deletes the session cookie.
* **`getUserFromCookie<User>(cookies: Cookies, cookieName?): User | null`**
  Decodes the cookie payload without signature verification (fast SSR).
* **`getUserFromRequest<User>(request: Request, cookieName?): User | null`**
  Parses raw cookie header on standard web requests (e.g. Workers, Durable Objects).
* **`getVerifiedUserFromRequest<User>(request: Request, jwtSecret: string, cookieName?): Promise<User | null>`**
  Parses request cookies and cryptographically verifies the token signature.

### Client APIs (`@svelteflare/auth/client`)

* **`createAuth<User>(config: AuthClientConfig)`**
  Creates the client reactive state.
  * `get user(): User | null`: Returns the active user. Supports Svelte 5 reactive lookups.
  * `set user(value: User | null)`: Overrides local user state (optimistic mutations).
  * `isAuthenticated: boolean`: Helper check.
  * `init(user: MaybeGetter<User | null>)`: Binds layout page data.
  * `update(changes: Partial<User>): Promise<void>`: Optimistically updates user, syncs over WS, and rewrites the cookie.
  * `logout(): Promise<void>`: Deletes session and clears IndexedDB cache.

### Sync Server Handler (`@svelteflare/auth/server`)

* **`createAuthSync(config: SyncAuthConfig)`**
  Establishes the read-only `"users"` sync channel verifying WebSocket subscriptions.
