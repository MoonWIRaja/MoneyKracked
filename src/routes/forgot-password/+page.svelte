<script lang="ts">
  import { PixelButton, Card, Input, IsometricCard } from '$lib/components/ui';
  import { goto } from '$app/navigation';

  let email = $state('');
  let loading = $state(false);
  let success = $state(false);
  let error = $state('');

  async function handleForgotPassword() {
    if (!email) { error = 'INPUT_REQUIRED'; return; }
    loading = true; error = '';
    try {
      const response = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await response.json();
      if (response.ok) success = true;
      else throw new Error(data.error || 'TRANS_FAILURE');
    } catch (err: any) {
      error = err.message || 'SYSTEM_FAULT';
    } finally { loading = false; }
  }

  function goToLogin() { goto('/login'); }
</script>

<svelte:head>
  <title>Forgot Password - MoneyKracked</title>
</svelte:head>

<div class="min-h-screen bg-[var(--color-bg)] flex flex-col items-center justify-center p-6 relative overflow-hidden">
  <div class="absolute inset-0 opacity-10 pointer-events-none" 
    style="background-image: radial-gradient(var(--color-primary) 1px, transparent 1px); background-size: 24px 24px;">
  </div>

  <div class="w-full max-w-sm relative z-10">
    <div class="text-center mb-10">
      <div class="inline-flex items-center justify-center w-20 h-20 border-4 border-black bg-[var(--color-primary)] shadow-[4px_4px_0px_0px_var(--color-shadow)] mb-4">
        <span class="material-symbols-outlined text-4xl text-black">lock_open</span>
      </div>
      <h1 class="text-2xl font-display text-[var(--color-primary)] tracking-tighter uppercase">MoneyKracked</h1>
      <p class="text-[10px] font-mono text-[var(--color-text-muted)] uppercase tracking-widest mt-1">RECOVERY_PROTOCOL_v2</p>
    </div>

    <IsometricCard title={success ? "EMAIL_DISPATCHED" : "RECOVER_ACCESS"}>
      {#if !success}
        <div class="space-y-6">
          <p class="text-[10px] font-mono text-[var(--color-text-muted)] uppercase text-center mt-2 leading-relaxed">
            PROVIDE_ASSOCIATED_EMAIL_TO_RECEIVE_RECOVERY_DATA_LINK.
          </p>

          {#if error}
            <div class="p-3 border-4 border-black bg-[var(--color-danger)] text-black text-[10px] font-mono uppercase">
               ERROR: {error}
            </div>
          {/if}

          <div class="space-y-4">
            <Input
              label="RECOVERY_EMAIL"
              type="email"
              bind:value={email}
              placeholder="..."
              onkeydown={(e: KeyboardEvent) => e.key === 'Enter' && handleForgotPassword()}
              disabled={loading}
            />

            <PixelButton
              variant="primary"
              class="w-full text-xs"
              onclick={handleForgotPassword}
              loading={loading}
            >
              RUN_RECOVERY
            </PixelButton>

            <button
              onclick={goToLogin}
              class="w-full text-[9px] font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text)] uppercase tracking-wider transition-colors"
            >
              ABORT_AND_EXIT_TO_LOGIN
            </button>
          </div>
        </div>
      {:else}
        <div class="space-y-6 text-center py-4">
          <div class="inline-flex items-center justify-center w-16 h-16 border-4 border-black bg-[var(--color-primary)] shadow-[4px_4px_0px_0px_var(--color-shadow)] mb-2">
            <span class="material-symbols-outlined text-white animate-bounce">mark_email_read</span>
          </div>
          <p class="text-[10px] font-mono text-[var(--color-text)] uppercase">CHECK_RECOVERY_NODE: {email}</p>
          
          <div class="p-4 bg-[var(--color-surface-raised)] border-4 border-black text-left space-y-2">
            <p class="text-[9px] font-display text-[var(--color-primary)] uppercase">WARNING:</p>
            <p class="text-[9px] font-mono uppercase leading-relaxed">
               LINK_VALID_FOR_60_MINUTES_ONLY._IF_NOT_FOUND_CHECK_SPAM_FILTER_BUFFER.
            </p>
          </div>

          <PixelButton variant="primary" class="w-full text-xs" onclick={goToLogin}>
            BACK_TO_LOGIN
          </PixelButton>
        </div>
      {/if}
    </IsometricCard>

    <p class="text-center mt-8 text-[8px] font-mono text-[var(--color-text-muted)] uppercase tracking-widest opacity-50">
      AUTHENTICATION_LAYER_ACTIVE // NO_DUMMY_DATA
    </p>
  </div>
</div>
