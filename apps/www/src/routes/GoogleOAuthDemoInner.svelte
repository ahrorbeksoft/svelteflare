<script lang="ts">
  import { createGoogleLogin, googleLogout, GoogleLogin, GoogleOneTapLogin, decodeCredentials } from "@svelteflare/auth/google";
  
  let { result = $bindable(), error = $bindable(), showOneTap } = $props<{
    result: any;
    error: any;
    showOneTap: boolean;
  }>();

  // Initialize implicit flow login handler
  const implicitLogin = createGoogleLogin({
    flow: "implicit",
    onSuccess: (res) => {
      result = { flow: "implicit (token)", ...res };
      error = null;
    },
    onError: (err) => {
      error = err;
      result = null;
    }
  });

  // Initialize code flow login handler
  const codeLogin = createGoogleLogin({
    flow: "auth-code",
    onSuccess: (res) => {
      result = { flow: "auth-code", ...res };
      error = null;
    },
    onError: (err) => {
      error = err;
      result = null;
    }
  });

  function handleLogout() {
    googleLogout();
    result = null;
    error = null;
  }
</script>

<div class="space-y-6">
  <!-- Interactive Buttons -->
  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
    <!-- Standard Button -->
    <div class="p-4 border border-zinc-200 rounded-xl bg-zinc-50/50 flex flex-col justify-between space-y-3 hover:border-zinc-300 transition duration-200">
      <div>
        <h4 class="text-sm font-semibold text-zinc-800">Official Sign-In Button</h4>
        <p class="text-xs text-zinc-500 mt-1">Renders the official Google iframe button.</p>
      </div>
      <div class="pt-2">
        <GoogleLogin 
          onSuccess={(res) => {
            try {
              const decoded = res.credential ? decodeCredentials(res.credential) : null;
              result = { type: "credential (JWT)", ...res, decoded };
              error = null;
            } catch (err: any) {
              error = err;
              result = null;
            }
          }}
          onError={() => {
            error = new Error("Google Sign-In failed or was cancelled");
            result = null;
          }}
        />
      </div>
    </div>

    <!-- Custom Button: Implicit Flow -->
    <div class="p-4 border border-zinc-200 rounded-xl bg-zinc-50/50 flex flex-col justify-between space-y-3 hover:border-zinc-300 transition duration-200">
      <div>
        <h4 class="text-sm font-semibold text-zinc-800">Custom UI (Implicit Flow)</h4>
        <p class="text-xs text-zinc-500 mt-1">Requests an <code>access_token</code> using custom styles.</p>
      </div>
      <div>
        <button
          onclick={() => implicitLogin.login()}
          disabled={implicitLogin.loading}
          class="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium rounded-lg text-sm transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2 shadow-sm cursor-pointer"
        >
          {#if implicitLogin.loading}
            <span class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            Connecting...
          {:else}
            Request Access Token
          {/if}
        </button>
      </div>
    </div>

    <!-- Custom Button: Auth-Code Flow -->
    <div class="p-4 border border-zinc-200 rounded-xl bg-zinc-50/50 flex flex-col justify-between space-y-3 hover:border-zinc-300 transition duration-200">
      <div>
        <h4 class="text-sm font-semibold text-zinc-800">Custom UI (Auth Code Flow)</h4>
        <p class="text-xs text-zinc-500 mt-1">Requests an authorization <code>code</code> for your backend.</p>
      </div>
      <div>
        <button
          onclick={() => codeLogin.login()}
          disabled={codeLogin.loading}
          class="w-full py-2 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-medium rounded-lg text-sm transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2 shadow-sm cursor-pointer"
        >
          {#if codeLogin.loading}
            <span class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            Connecting...
          {:else}
            Request Auth Code
          {/if}
        </button>
      </div>
    </div>

    <!-- Logout -->
    <div class="p-4 border border-zinc-200 rounded-xl bg-zinc-50/50 flex flex-col justify-between space-y-3 hover:border-zinc-300 transition duration-200">
      <div>
        <h4 class="text-sm font-semibold text-zinc-800">Google Session Logout</h4>
        <p class="text-xs text-zinc-500 mt-1">Disables auto-select for next sign-in.</p>
      </div>
      <div>
        <button
          onclick={handleLogout}
          class="w-full py-2 px-4 bg-zinc-800 hover:bg-zinc-950 text-white font-medium rounded-lg text-sm transition-all duration-200 active:scale-[0.98] shadow-sm cursor-pointer"
        >
          Disable Auto-Select
        </button>
      </div>
    </div>
  </div>

  {#if showOneTap}
    <!-- One Tap Trigger -->
    <GoogleOneTapLogin 
      onSuccess={(res) => {
        try {
          const decoded = res.credential ? decodeCredentials(res.credential) : null;
          result = { type: "one-tap-credential (JWT)", ...res, decoded };
          error = null;
        } catch (err: any) {
          error = err;
          result = null;
        }
      }}
      onError={() => {
        error = new Error("One Tap login failed or was dismissed");
        result = null;
      }}
    />
  {/if}
</div>
