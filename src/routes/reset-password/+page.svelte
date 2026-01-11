<script lang="ts">
  import { PixelButton, Card, Input, IsometricCard } from '$lib/components/ui';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  let token = $state('');
  let newPassword = $state('');
  let confirmPassword = $state('');
  let loading = $state(false);
  let success = $state(false);
  let error = $state('');
  let isValidToken = $state(true);

  onMount(() => {
    const urlToken = $page.url.searchParams.get('token');
    if (!urlToken) {
      isValidToken = false;
      error = 'INVALID_RESET_LINK';
    }
    token = urlToken || '';
  });

  async function handleResetPassword() {
    if (!newPassword || !confirmPassword) { error = 'INPUT_REQUIRED'; return; }
    if (newPassword.length < 8) { error = 'KEY_TOO_SHORT'; return; }
    if (newPassword !== confirmPassword) { error = 'PASSWORDS_MISMATCH'; return; }

    loading = true; error = '';
    try {
      const response = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword })
      });
      const data = await response.json();
      if (response.ok) success = true;
      else throw new Error(data.error || 'RESET_FAILURE');
    } catch (err: any) {
      error = err.message || 'SYSTEM_FAULT';
    } finally { loading = false; }
  }

  function goToLogin() { goto('/login'); }
</script>

<svelte:head>
  <title>Reset Password - MoneyKracked</title>
</svelte:head>

<div class="min-h-screen bg-[var(--color-bg)] flex flex-col items-center justify-center p-6 relative overflow-hidden">
  <div class="absolute inset-0 opacity-10 pointer-events-none" 
    style="background-image: radial-gradient(var(--color-primary) 1px, transparent 1px); background-size: 24px 24px;">
  </div>

  <div class="w-full max-w-sm relative z-10">
    <div class="text-center mb-10">
      <div class="inline-flex items-center justify-center w-20 h-20 border-4 border-black bg-[var(--color-primary)] shadow-[4px_4px_0px_0px_var(--color-shadow)] mb-4">
        <span class="material-symbols-outlined text-4xl text-black">key_visualizer</span>
      </div>
      <h1 class="text-2xl font-display text-[var(--color-primary)] tracking-tighter uppercase">MoneyKracked</h1>
      <p class="text-[10px] font-mono text-[var(--color-text-muted)] uppercase tracking-widest mt-1">PASSWORD_RECONSTRUCTION</p>
    </div>

    <IsometricCard title={!isValidToken ? "LINK_EXPIRED" : success ? "KEY_UPDATED" : "NEW_CREDENTIALS"}>
      {#if !isValidToken}
        <div class="space-y-6 text-center py-4">
          <div class="inline-flex items-center justify-center w-16 h-16 border-4 border-black bg-[var(--color-danger)] shadow-[4px_4px_0px_0px_var(--color-shadow)] mb-2">
            <span class="material-symbols-outlined text-white">link_off</span>
          </div>
          <p class="text-[10px] font-mono text-[var(--color-text-muted)] uppercase">THE_RECOVERY_TOKEN_IS_INVALID_OR_HAS_REACHED_EXPIRATION.</p>
          <div class="space-y-3 pt-2">
            <PixelButton variant="primary" class="w-full text-xs" onclick={() => goto('/forgot-password')}>REQUEST_NEW_LINK</PixelButton>
            <PixelButton variant="ghost" class="w-full text-xs" onclick={goToLogin}>RETURN_TO_BASE</PixelButton>
          </div>
        </div>

      {:else if !success}
        <div class="space-y-6">
          <p class="text-[10px] font-mono text-[var(--color-text-muted)] uppercase text-center mt-2">CONFIGURE_NEW_ACCESS_KEY_FOR_USER_ACCOUNT.</p>

          {#if error}
            <div class="p-3 border-4 border-black bg-[var(--color-danger)] text-black text-[10px] font-mono uppercase">
               ERROR: {error}
            </div>
          {/if}

          <div class="space-y-5">
            <Input
              label="NEW_SECRET_KEY"
              type="password"
              bind:value={newPassword}
              placeholder="..."
              disabled={loading}
            />

            <Input
              label="VERIFY_NEW_KEY"
              type="password"
              bind:value={confirmPassword}
              placeholder="..."
              disabled={loading}
            />

            <div class="p-4 bg-[var(--color-surface-raised)] border-4 border-black text-left space-y-2">
                <p class="text-[9px] font-display text-[var(--color-primary)] uppercase">CONSTRAINTS:</p>
                <ul class="text-[8px] font-mono uppercase space-y-1">
                  <li class="flex items-center gap-2"><span class="w-1.5 h-1.5 bg-[var(--color-primary)]"></span> LENGTH >= 8 CHARS</li>
                  <li class="flex items-center gap-2"><span class="w-1.5 h-1.5 bg-[var(--color-primary)]"></span> MUST_DIFFER_FROM_PREVIOUS</li>
                </ul>
            </div>

            <PixelButton
              variant="primary"
              class="w-full text-xs"
              onclick={handleResetPassword}
              loading={loading}
            >
              COMMIT_CHANGES
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
            <span class="material-symbols-outlined text-white animate-bounce">verified_user</span>
          </div>
          <p class="text-[10px] font-mono text-[var(--color-text)] uppercase">CREDENTIAL_SYNCHRONIZATION_COMPLETE!</p>
          <p class="text-[9px] font-mono text-[var(--color-text-muted)] uppercase leading-relaxed">
             NEW_KEY_IS_NOW_ACTIVE._STORE_SECURELY_IN_VAULT.
          </p>
          <PixelButton variant="primary" class="w-full text-xs" onclick={goToLogin}>
            INIT_NEW_SESSION
          </PixelButton>
        </div>
      {/if}
    </IsometricCard>

    <p class="text-center mt-8 text-[8px] font-mono text-[var(--color-text-muted)] uppercase tracking-widest opacity-50">
      SECURITY_SUBSYSTEM_ONLINE // NO_DUMMY_DATA
    </p>
  </div>
</div>
