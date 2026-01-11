<script lang="ts">
  import { Sidebar } from '$lib/components/layout';
  import { PixelLoader, FloatingDecoration } from '$lib/components/ui';
  import type { Snippet } from 'svelte';
  import { onMount } from 'svelte';
  import { initializeWithServerData, getAppTheme, setAppTheme, getSidebarState, setSidebarState } from '$lib/stores/app-store.svelte';
  import { goto } from '$app/navigation';

  interface Props {
    data: {
      rates?: Record<string, Record<string, number>>;
      currency?: string;
      theme?: string;
      user?: {
        id: string;
        email: string;
        name: string;
        image?: string | null;
      } | null;
    };
    children: Snippet;
  }

  let { data, children }: Props = $props();

  let user = $state<{
    id: string;
    email: string;
    name: string;
    image?: string | null;
  } | null>(null);
  
  // Use global store for sidebar state
  let mobileSidebarOpen = $derived(getSidebarState());
  let loading = $state(false);

  // ============================================================
  // CRITICAL: Use onMount instead of $effect to prevent reactive loops
  // $effect tracks $props() which can cause infinite re-runs
  // onMount runs EXACTLY ONCE after component mounts
  // ============================================================
  onMount(() => {
    // Initialize user state from props (one-time)
    user = data.user || null;
    if (!user) {
      goto('/login', { replaceState: true });
      return;
    }

    // Initialize currency/theme store from server data (one-time)
    if (typeof window !== 'undefined') {
      const rates = data?.rates;
      const currency = data?.currency;
      const theme = data?.theme;

      if (rates && currency) {
        initializeWithServerData({
          rates,
          currency: currency as any,
          theme
        });
        if (theme) setAppTheme(theme);
      }
    }
  });

  // Apply theme to document documentElement
  $effect(() => {
    if (typeof document !== 'undefined') {
      const theme = getAppTheme();
      document.documentElement.setAttribute('data-theme', theme);
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  });
</script>

{#if loading}
  <div class="min-h-screen bg-[var(--color-bg)] flex items-center justify-center">
    <PixelLoader size="lg" label="Syncing Data..." />
  </div>
{:else}
  <div class="flex h-screen w-full overflow-hidden bg-[var(--color-bg)] transition-colors duration-200">
    <!-- 3D Decorations in background -->
    <FloatingDecoration top="15%" left="5%" color="var(--color-primary)" size="30px" delay="0s" rotate="15deg" />
    <FloatingDecoration top="70%" left="8%" color="var(--color-secondary)" size="20px" delay="2s" rotate="-10deg" />
    <FloatingDecoration top="20%" left="85%" color="var(--color-success)" size="25px" delay="4s" rotate="45deg" />
    <FloatingDecoration top="80%" left="90%" color="var(--color-warning)" size="35px" delay="1s" rotate="-30deg" />

    <!-- Mobile Backdrop -->
    {#if mobileSidebarOpen}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div 
        class="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" 
        onclick={() => setSidebarState(false)}
      ></div>
    {/if}
    
    <!-- Sidebar Navigation -->
    <Sidebar user={user} mobileOpen={mobileSidebarOpen} onClose={() => setSidebarState(false)} />
    
    <!-- Main Content wrapper -->
    <div class="flex-1 flex flex-col min-w-0 h-full">

      <!-- Main Content Area -->
      <main class="flex-1 min-h-0 relative">
        <div class="absolute inset-0 opacity-5 pointer-events-none" 
             style="background-image: radial-gradient(var(--color-text-muted) 1px, transparent 1px); background-size: 20px 20px;">
        </div>
        
        <div class="relative z-10 w-full h-full flex flex-col min-h-0 overflow-hidden">
          {@render children()}
        </div>
      </main>
    </div>
  </div>
{/if}
