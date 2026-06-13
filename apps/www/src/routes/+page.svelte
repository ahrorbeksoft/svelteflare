<script lang="ts">
	import { Check, ListTodo, Plus, RefreshCw, Trash2 } from "lucide-svelte";
	import { invalidateAll } from "$app/navigation";

	import { todosTable } from "$lib/sync-client";
	import type { Todo } from "$lib/server/db/schema";
	import { auth } from "$lib/auth-client";

	let title = $state("");
	let filter = $state<"all" | "active" | "completed">("all");
	let errorMessage = $state("");
	let isRefreshing = $state(false);

	let newName = $state("");

	// Prefill the renaming input when the user changes
	$effect(() => {
		if (auth.user) {
			newName = auth.user.name;
		} else {
			newName = "";
		}
	});

	// Fetch todos reactively using Dexie liveQuery
	const todosQuery = todosTable.liveQuery((t) => t.orderBy("createdAt").reverse().toArray());

	const visibleTodos = $derived(
		filter === "all"
			? (todosQuery.data ?? [])
			: (todosQuery.data ?? []).filter((todo) => todo.completed === (filter === "completed"))
	);

	const activeCount = $derived((todosQuery.data ?? []).filter((todo) => !todo.completed).length);
	const completedCount = $derived((todosQuery.data ?? []).length - activeCount);

	async function addTodo() {
		const nextTitle = title.trim();

		if (!nextTitle) {
			errorMessage = "Add a todo title first.";
			return;
		}

		errorMessage = "";
		try {
			await todosTable.add({
				id: crypto.randomUUID(),
				title: nextTitle,
				completed: false,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString()
			});
			title = "";
		} catch {
			errorMessage = "Could not add todo.";
		}
	}

	async function toggleTodo(todo: Todo) {
		errorMessage = "";
		try {
			await todosTable.put(todo.id, {
				completed: !todo.completed
			});
		} catch {
			errorMessage = "Could not update todo.";
		}
	}

	async function renameTodo(todo: Todo, nextTitle: string) {
		const trimmed = nextTitle.trim();

		if (!trimmed || trimmed === todo.title) {
			return;
		}

		errorMessage = "";
		try {
			await todosTable.put(todo.id, {
				title: trimmed
			});
		} catch {
			errorMessage = "Could not rename todo.";
		}
	}

	async function removeTodo(todo: Todo) {
		errorMessage = "";
		try {
			await todosTable.delete(todo.id);
		} catch {
			errorMessage = "Could not delete todo.";
		}
	}

	async function refreshTodos() {
		isRefreshing = true;
		errorMessage = "";
		try {
			await new Promise((resolve) => setTimeout(resolve, 300));
		} finally {
			isRefreshing = false;
		}
	}

	async function loginAsDummy() {
		errorMessage = "";
		try {
			const res = await fetch("/api/auth/login", { method: "POST" });
			if (!res.ok) throw new Error("Failed to login");
			await invalidateAll();
		} catch (err: any) {
			errorMessage = err.message || "Failed to login";
		}
	}

	async function logout() {
		errorMessage = "";
		try {
			await auth.logout();
			await invalidateAll();
		} catch (err: any) {
			errorMessage = err.message || "Failed to logout";
		}
	}

	async function updateProfile() {
		errorMessage = "";
		try {
			const nameVal = newName.trim();
			if (!nameVal) {
				errorMessage = "Profile name cannot be empty.";
				return;
			}
			await auth.update({ name: nameVal });
		} catch (err: any) {
			errorMessage = err.message || "Failed to update profile";
		}
	}

	async function toggleBan(banned: boolean) {
		errorMessage = "";
		try {
			const res = await fetch("/api/auth/ban", {
				method: "POST",
				body: JSON.stringify({ banned }),
				headers: { "Content-Type": "application/json" }
			});
			if (!res.ok) throw new Error("Failed to toggle ban");
			// Force reload to re-run WebSocket handshake / subscription
			window.location.reload();
		} catch (err: any) {
			errorMessage = err.message || "Failed to toggle ban";
		}
	}
</script>

<svelte:head>
	<title>Todos</title>
</svelte:head>

<main class="min-h-screen bg-zinc-50 text-zinc-950">
	<section class="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-8 sm:px-6 lg:py-12">
		<header class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
			<div>
				<div
					class="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm"
				>
					<ListTodo size={22} />
				</div>
				<h1 class="text-3xl font-semibold tracking-normal">Todos</h1>
				<p class="mt-2 text-sm text-zinc-600">{activeCount} active, {completedCount} completed</p>
			</div>

			<button
				class="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-100"
				type="button"
				onclick={refreshTodos}
				disabled={isRefreshing}
				aria-label="Refresh todos"
			>
				<RefreshCw size={16} />
				{isRefreshing ? "Refreshing" : "Refresh"}
			</button>
		</header>

		<!-- Auth Test Control Panel -->
		<div class="mb-6 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
			<h2 class="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Authentication Testing Control</h2>
			
			<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div class="flex flex-col gap-1">
					<div class="flex items-center gap-3">
						<div class="h-3 w-3 rounded-full {auth.isAuthenticated ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500 animate-pulse'}"></div>
						<div>
							<p class="text-sm font-medium text-zinc-900">
								{#if auth.isAuthenticated}
									Logged in as <span class="font-semibold text-emerald-700">{auth.user?.name}</span>
								{:else}
									Guest Mode (Local-Only Sync)
								{/if}
							</p>
							<p class="text-xs text-zinc-500">
								{#if auth.isAuthenticated}
									Session active. WebSocket verified via "users" channel.
								{:else}
									Todos are saved locally in Dexie. Log in to sync.
								{/if}
							</p>
						</div>
					</div>

					{#if auth.isAuthenticated}
						<div class="mt-3 flex items-center gap-2 border-t border-zinc-100 pt-3">
							<input
								class="h-8 rounded-md border border-zinc-200 px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
								bind:value={newName}
								placeholder="New name"
								aria-label="New name"
							/>
							<button
								class="inline-flex h-8 items-center justify-center rounded-md bg-emerald-600 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700"
								type="button"
								onclick={updateProfile}
							>
								Rename User
							</button>
						</div>
					{/if}
				</div>

				<div class="flex flex-wrap gap-2 self-start sm:self-center">
					{#if !auth.isAuthenticated}
						<button
							class="inline-flex h-9 items-center justify-center rounded-md bg-emerald-600 px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700"
							type="button"
							onclick={loginAsDummy}
						>
							Log In as Dummy User
						</button>
					{:else}
						<button
							class="inline-flex h-9 items-center justify-center rounded-md border border-zinc-200 bg-white px-4 text-xs font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-100"
							type="button"
							onclick={logout}
						>
							Log Out
						</button>
						<button
							class="inline-flex h-9 items-center justify-center rounded-md bg-red-600 px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700"
							type="button"
							onclick={() => toggleBan(true)}
						>
							Simulate Server Ban (Revoke)
						</button>
					{/if}
					
					<button
						class="inline-flex h-9 items-center justify-center rounded-md border border-zinc-200 bg-zinc-100 px-4 text-xs font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-200"
						type="button"
						onclick={() => toggleBan(false)}
					>
						Reset Server Ban
					</button>
				</div>
			</div>
		</div>

		<form
			class="mb-5 flex gap-2 rounded-lg border border-zinc-200 bg-white p-2 shadow-sm"
			onsubmit={(event) => {
				event.preventDefault();
				addTodo();
			}}
		>
			<input
				class="min-w-0 flex-1 rounded-md px-3 text-base outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-emerald-500"
				bind:value={title}
				placeholder="Add a todo"
				aria-label="Todo title"
			/>
			<button
				class="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
				type="submit"
			>
				<Plus size={18} />
				Add
			</button>
		</form>

		{#if errorMessage}
			<p class="mb-4 text-sm font-medium text-red-600">{errorMessage}</p>
		{/if}

		<div
			class="mb-4 flex rounded-lg border border-zinc-200 bg-white p-1 shadow-sm"
			role="tablist"
			aria-label="Todo filters"
		>
			{#each ["all", "active", "completed"] as option (option)}
				<button
					class="h-9 flex-1 rounded-md px-3 text-sm font-medium capitalize transition {filter ===
					option
						? 'bg-zinc-900 text-white shadow-sm'
						: 'text-zinc-600 hover:bg-zinc-100'}"
					type="button"
					onclick={() => (filter = option as typeof filter)}
					aria-selected={filter === option}
					role="tab"
				>
					{option}
				</button>
			{/each}
		</div>

		<div class="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
			{#if todosQuery.isLoading}
				<div class="p-8 text-center text-sm text-zinc-500">Loading todos...</div>
			{:else if todosQuery.status === "error"}
				<div class="p-8 text-center text-sm text-red-500">Error loading database: {todosQuery.error?.message || todosQuery.error}</div>
			{:else if visibleTodos.length === 0}
				<div class="p-8 text-center">
					<p class="font-medium text-zinc-800">No todos here.</p>
					<p class="mt-1 text-sm text-zinc-500">Add one above and it will sync reactively.</p>
				</div>
			{:else}
				<ul class="divide-y divide-zinc-100">
					{#each visibleTodos as todo (todo.id)}
						<li class="flex items-center gap-3 p-3">
							<button
								class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition {todo.completed
									? 'border-emerald-600 bg-emerald-600 text-white'
									: 'border-zinc-300 bg-white text-transparent hover:border-emerald-500'}"
								type="button"
								onclick={() => toggleTodo(todo)}
								aria-label={todo.completed ? "Mark todo active" : "Mark todo completed"}
							>
								<Check size={18} />
							</button>

							<input
								class="min-w-0 flex-1 rounded-md px-2 py-2 text-sm transition outline-none focus:bg-zinc-50 focus:ring-2 focus:ring-emerald-500 {todo.completed
									? 'text-zinc-400 line-through'
									: 'text-zinc-900'}"
								value={todo.title}
								onblur={(event) => renameTodo(todo, event.currentTarget.value)}
								onkeydown={(event) => {
									if (event.key === "Enter") {
										event.currentTarget.blur();
									}
								}}
								aria-label="Edit todo title"
							/>

							<button
								class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-zinc-400 transition hover:bg-red-50 hover:text-red-600"
								type="button"
								onclick={() => removeTodo(todo)}
								aria-label="Delete todo"
							>
								<Trash2 size={17} />
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</section>
</main>
