<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  onMount(() => {
    // Use server-side session data (which checks mk_session cookie)
    if (data.user) {
      goto('/dashboard', { replaceState: true });
    } else {
      goto('/login', { replaceState: true });
    }
  });
</script>

<div class="min-h-screen bg-[var(--color-bg)] flex flex-col items-center justify-center p-6 relative overflow-hidden">
  <div class="absolute inset-0 opacity-10 pointer-events-none" 
    style="background-image: radial-gradient(var(--color-primary) 1px, transparent 1px); background-size: 24px 24px;">
  </div>

  <div class="relative z-10 flex flex-col items-center gap-6">
    <div class="w-16 h-16 border-4 border-black bg-[var(--color-primary)] shadow-[4px_4px_0px_0px_var(--color-shadow)] flex items-center justify-center animate-bounce">
        <span class="material-symbols-outlined text-black text-3xl">refresh</span>
    </div>
    <div class="text-center">
        <h1 class="text-xl font-display text-[var(--color-primary)] uppercase tracking-tighter">BOOTING_SYSTEM...</h1>
        <p class="text-[9px] font-mono text-[var(--color-text-muted)] uppercase tracking-widest mt-2">ESTABLISHING_ENCRYPTED_CONNECTION</p>
    </div>
    
    <div class="w-48 h-4 border-4 border-black bg-black p-1">
        <div class="h-full bg-[var(--color-primary)] animate-[shimmer_2s_infinite]" style="width: 60%"></div>
    </div>
  </div>
</div>

<style>
    @keyframes shimmer {
        0% { opacity: 0.5; width: 0%; }
        50% { opacity: 1; width: 70%; }
        100% { opacity: 0.5; width: 100%; }
    }
</style>
