import { onDestroy } from "svelte";
import { liveQuery } from "dexie";

export function useLiveQuery<T>(queryFn: () => Promise<T> | T): {
  readonly current: T | undefined;
} {
  let data = $state<T | undefined>(undefined);

  if (typeof window !== "undefined") {
    const observable = liveQuery(queryFn);
    const subscription = observable.subscribe({
      next: (val) => {
        data = val;
      },
      error: (err) => {
        console.error("liveQuery error:", err);
      },
    });
    onDestroy(() => {
      subscription.unsubscribe();
    });
  }

  return {
    get current() {
      return data;
    },
  };
}
