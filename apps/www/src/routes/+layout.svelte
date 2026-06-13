<script lang="ts">
	import "./layout.css";
	import favicon from "$lib/assets/favicon.svg";
	import { auth } from "$lib/auth-client";

	let { data, children } = $props();

	// Initialize reactive client auth with a getter!
	auth.init(() => data.user);
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{@render children()}
