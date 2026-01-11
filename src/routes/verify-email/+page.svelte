<script lang="ts">
  import { PixelButton, IsometricCard } from '$lib/components/ui';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';

  let status = $state<'loading' | 'success' | 'error'>('loading');
  let message = $state('');

  onMount(async () => {
    const token = $page.url.searchParams.get('token');
    if (!token) {
      status = 'error';
      message = 'INVALID_TOKEN_SIGNAL';
      return;
    }

    try {
      const response = await fetch('/api/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      const data = await response.json();
      if (response.ok) {
        status = 'success';
        message = 'IDENTITY_VERIFIED_SUCCESSFULLY';
      } else {
        status = 'error';
        message = 'TOKEN_EXPIRED_OR_CORRUPT';
      }
    } catch (error) {
      status = 'error';
      message = 'NETWORK_INTERFERENCE';
    }
  });

  function goToLogin() { window.location.href = '/login'; }
</script>

<svelte:head>
  <title>Verify Email - MoneyKracked</title>
</svelte:head>

<div class="min-h-screen bg-[var(--color-bg)] flex flex-col items-center justify-center p-6 relative overflow-hidden">
  <div class="absolute inset-0 opacity-10 pointer-events-none" 
    style="background-image: radial-gradient(var(--color-primary) 1px, transparent 1px); background-size: 24px 24px;">
  </div>

  <div class="w-full max-w-sm relative z-10">
    <div class="text-center mb-10">
      <div class="inline-flex items-center justify-center w-20 h-20 border-4 border-black bg-[var(--color-primary)] shadow-[4px_4px_0px_0px_var(--color-shadow)] mb-4">
        {#if status === 'loading'}
          <span class="material-symbols-outlined text-4xl text-black animate-spin">sync</span>
        {:else if status === 'success'}
          <span class="material-symbols-outlined text-4xl text-black">verified</span>
        {:else}
          <span class="material-symbols-outlined text-4xl text-black">report_gmailerrorred</span>
        {/if}
      </div>
      <h1 class="text-2xl font-display text-[var(--color-primary)] tracking-tighter uppercase">MoneyKracked</h1>
      <p class="text-[10px] font-mono text-[var(--color-text-muted)] uppercase tracking-widest mt-1">IDENTITY_VALIDATION_LAYER</p>
    </div>

    <IsometricCard title={status === 'loading' ? 'SCANNING' : status === 'success' ? 'VALIDATED' : 'ERROR'}>
      {#if status === 'loading'}
        <div class="text-center py-8 space-y-4">
          <p class="text-[10px] font-mono text-[var(--color-text-muted)] uppercase">AUTORUNNING_VERIFICATION_SEQUENCE...</p>
          <div class="flex justify-center gap-1">
             <div class="h-3 w-3 bg-[var(--color-primary)] animate-bounce"></div>
             <div class="h-3 w-3 bg-[var(--color-primary)] animate-bounce delay-75"></div>
             <div class="h-3 w-3 bg-[var(--color-primary)] animate-bounce delay-150"></div>
          </div>
        </div>
      {:else if status === 'success'}
        <div class="text-center py-6 space-y-6">
          <p class="text-[10px] font-mono text-[var(--color-text)] uppercase">{message}</p>
          <div class="p-4 bg-[var(--color-primary)]/[0.1] border-4 border-black text-left">
             <p class="text-[9px] font-mono uppercase text-[var(--color-primary)]">PROTOCOL_COMPLETED_MEMBER_ACCESS_GRANTED.</p>
          </div>
          <PixelButton variant="primary" class="w-full text-xs" onclick={goToLogin}>
            SYSTEM_LOGIN
          </PixelButton>
        </div>
      {:else}
        <div class="text-center py-6 space-y-6">
          <p class="text-[10px] font-mono text-[var(--color-danger)] uppercase">{message}</p>
          <div class="p-4 bg-[var(--color-danger)]/[0.1] border-4 border-black text-left">
             <p class="text-[9px] font-mono uppercase text-[var(--color-danger)]">VALIDATION_LINK_REJECTED_OR_LINK_TIMEOUT.</p>
          </div>
          <PixelButton variant="ghost" class="w-full text-xs" onclick={goToLogin}>
            RETURN_TO_BASE
          </PixelButton>
        </div>
      {/if}
    </IsometricCard>

    <p class="text-center mt-8 text-[8px] font-mono text-[var(--color-text-muted)] uppercase tracking-widest opacity-50">
      SECURITY_SUBSYSTEM_ONLINE // NO_DUMMY_DATA
    </p>
  </div>
</div>
