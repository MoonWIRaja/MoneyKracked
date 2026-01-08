<script lang="ts">
  import { Sidebar } from '$lib/components/layout';
  import type { Snippet } from 'svelte';

  interface Props {
    data: {
      user: {
        id: string;
        email: string;
        name: string;
        image?: string | null;
      } | null;
    };
    children?: Snippet;
  }

  let { data, children }: Props = $props();
</script>

<div class="flex h-screen w-full overflow-hidden">
  <!-- Sidebar Navigation -->
  <Sidebar user={data.user} />

  <!-- Main Content Area -->
  <main class="flex-1 overflow-y-auto bg-bg-dark p-4 lg:p-8">
    <div class="mx-auto max-w-6xl flex flex-col gap-8">
      {#if children}
        {@render children()}
      {/if}
    </div>
  </main>
</div>

