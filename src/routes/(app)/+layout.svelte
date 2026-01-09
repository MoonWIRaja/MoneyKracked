<script lang="ts">
  import { Sidebar } from '$lib/components/layout';
  import type { Snippet } from 'svelte';
  import { initializeWithServerData } from '$lib/stores/app-store';

  interface Props {
    data: {
      user: {
        id: string;
        email: string;
        name: string;
        image?: string | null;
      } | null;
      // Preloaded from server for instant access
      rates?: Record<string, Record<string, number>>;
      currency?: string;
      theme?: string;
    };
    children: Snippet;
  }

  let { data, children }: Props = $props();

  // PERFORMANCE: Initialize store with server-preloaded data IMMEDIATELY
  // This happens before component renders, so all child pages have instant access
  // to exchange rates and preferences without any API calls
  $effect(() => {
    // Capture data values in effect to avoid closure issues
    const rates = data?.rates;
    const currency = data?.currency;
    const theme = data?.theme;

    if (typeof window !== 'undefined' && rates && currency) {
      initializeWithServerData({
        rates,
        currency: currency as any,
        theme
      });
    }
  });
</script>

<div class="flex h-screen w-full overflow-hidden">
  <!-- Sidebar Navigation -->
  <Sidebar user={data.user} />

  <!-- Main Content Area -->
  <main class="flex-1 overflow-y-auto bg-bg-dark p-4 lg:p-8">
    {@render children()}
  </main>
</div>


