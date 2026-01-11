<script lang="ts">
  import { PixelButton, Input, IsometricCard, FloatingDecoration } from '$lib/components/ui';
  import { authClient } from '$lib/auth-client';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';

  let identifier = $state('');
  let password = $state('');
  let error = $state('');
  let loading = $state(false);

  let showTwoFactor = $state(false);
  let twoFactorCode = $state('');
  let pendingUserId = $state('');
  let useBackupCode = $state(false);

  $effect(() => {
    const urlError = $page.url.searchParams.get('error');
    if (urlError === 'oauth_failed') {
      error = 'GitHub login failed. Use email/password.';
    } else if (urlError === 'state_mismatch') {
      error = 'Session expired. Try again.';
    } else if (urlError === 'not_linked' || urlError === 'github_not_linked') {
      error = 'Link GitHub in Settings first.';
    }
  });

  async function handleLogin(e: Event) {
    e.preventDefault();
    error = '';
    loading = true;
    try {
      const isEmail = identifier.includes('@');
      let result;
      if (isEmail) {
        result = await authClient.signIn.email({ email: identifier, password });
      } else {
        result = await authClient.signIn.username({ username: identifier, password });
      }

      if (result?.error) {
        error = result.error.message || 'Login failed.';
        loading = false;
      } else if (result?.data) {
        const user = result.data.user;
        if (user.emailVerified === false) {
          error = 'Verify your email first.';
          loading = false;
          return;
        }
        const twoFaResponse = await fetch('/api/2fa');
        const twoFaData = await twoFaResponse.json();
        if (twoFaData.enabled) {
          pendingUserId = user.id; showTwoFactor = true; loading = false;
        } else {
          setTimeout(() => { window.location.replace('/dashboard'); }, 100);
        }
      }
    } catch (err: any) {
      error = 'An error occurred';
      loading = false;
    }
  }

  async function verifyTwoFactor() {
    error = '';
    loading = true;
    try {
      const response = await fetch('/api/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId: pendingUserId, code: twoFactorCode, isBackup: useBackupCode })
      });
      const result = await response.json();
      if (result.success) {
        setTimeout(() => { window.location.replace('/dashboard'); }, 100);
      } else {
        error = 'Invalid code';
        loading = false;
      }
    } catch (err) {
      error = 'Verification failed';
      loading = false;
    }
  }

  function handleGitHubLogin() {
    window.location.href = '/api/github-oauth?mode=login&callbackURL=/dashboard';
  }

  let resendLoading = $state(false);
  let resendSuccess = $state(false);

  async function resendVerificationEmail() {
    resendLoading = true;
    try {
      const resp = await fetch('/api/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: identifier })
      });
      if (resp.ok) resendSuccess = true;
    } finally { resendLoading = false; }
  }
</script>

<svelte:head>
  <title>Login - MoneyKracked</title>
</svelte:head>

<div class="min-h-screen bg-[var(--color-bg)] flex flex-col items-center justify-center p-6 relative overflow-hidden">
  <!-- 3D Decorations in background -->
  <FloatingDecoration top="10%" left="10%" color="var(--color-primary)" size="30px" delay="0s" rotate="10deg" />
  <FloatingDecoration top="80%" left="15%" color="var(--color-secondary)" size="25px" delay="2s" rotate="-15deg" />
  <FloatingDecoration top="20%" left="80%" color="var(--color-success)" size="20px" delay="4s" rotate="30deg" />
  <FloatingDecoration top="70%" left="85%" color="var(--color-warning)" size="35px" delay="1s" rotate="-20deg" />

  <!-- Decorative Grid Background (Same as layout) -->
  <div class="absolute inset-0 opacity-10 pointer-events-none" 
    style="background-image: radial-gradient(var(--color-primary) 1px, transparent 1px); background-size: 24px 24px;">
  </div>

  <div class="w-full max-w-sm relative z-10">
    <!-- Brand -->
    <div class="text-center mb-10">
      <div class="inline-flex items-center justify-center w-20 h-20 border-4 border-black bg-[var(--color-primary)] shadow-[4px_4px_0px_0px_var(--color-shadow)] mb-4">
        <span class="material-symbols-outlined text-4xl text-black">account_balance_wallet</span>
      </div>
      <h1 class="text-2xl font-display text-[var(--color-primary)] tracking-tight uppercase px-2">MoneyKracked</h1>
      <p class="text-[12px] font-mono text-[var(--color-text-muted)] uppercase tracking-widest mt-1">Secure Access</p>
    </div>

    <IsometricCard title={showTwoFactor ? "Security Lock" : "Account Login"}>
      {#if showTwoFactor}
        <div class="space-y-6">
          <p class="text-[10px] font-mono text-[var(--color-text-muted)] uppercase text-center mt-2">Enter Verification Code</p>

          {#if error}
            <div class="p-3 border-4 border-black bg-[var(--color-danger)] text-black text-[10px] font-mono uppercase">
               ERROR: {error}
            </div>
          {/if}

          <!-- Method Switcher -->
          <div class="flex border-4 border-black p-1 bg-[var(--color-surface-raised)]">
            <button 
              class="flex-1 py-2 text-[9px] font-display uppercase {!useBackupCode ? 'bg-black text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'}"
              onclick={() => { useBackupCode = false; twoFactorCode = ''; }}
            >
              App Code
            </button>
            <button 
              class="flex-1 py-2 text-[9px] font-display uppercase {useBackupCode ? 'bg-black text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'}"
              onclick={() => { useBackupCode = true; twoFactorCode = ''; }}
            >
              Backup Key
            </button>
          </div>

          <form onsubmit={(e) => { e.preventDefault(); verifyTwoFactor(); }} class="space-y-6">
            <input 
              type="text" 
              bind:value={twoFactorCode}
              placeholder={useBackupCode ? 'XXXXXXXX' : '000000'}
              class="iso-input text-center text-3xl font-mono tracking-widest"
              maxlength={useBackupCode ? 8 : 6}
              required
            />

            <div class="flex gap-3">
              <PixelButton variant="ghost" class="flex-1 text-xs" onclick={() => showTwoFactor = false}>Back</PixelButton>
              <PixelButton variant="primary" class="flex-1 text-xs" type="submit" loading={loading}>Verify</PixelButton>
            </div>
          </form>
        </div>
      {:else}
        <div class="space-y-6">
          {#if error || resendSuccess}
            <div class="p-3 border-4 border-black font-mono text-[10px] uppercase
               {error ? 'bg-[var(--color-danger)] text-black' : 'bg-[var(--color-primary)] text-black'}">
               {error ? `Login Error: ${error}` : 'Verification link sent to your inbox'}
               
               {#if error && identifier.includes('@')}
                 <button 
                    onclick={resendVerificationEmail} 
                    class="block mt-2 underline hover:no-underline opacity-70"
                    disabled={resendLoading}
                 >
                    {resendLoading ? 'Resending...' : 'Resend Link'}
                 </button>
               {/if}
            </div>
          {/if}

          <form onsubmit={handleLogin} class="space-y-5">
            <Input label="Email or Username" bind:value={identifier} placeholder="Enter your email" required />
            <Input label="Password" type="password" bind:value={password} placeholder="••••••••" required />
            
            <div class="flex items-center justify-between">
              <label class="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" class="w-5 h-5 border-4 border-black bg-black checked:bg-[var(--color-primary)] outline-none" />
                <span class="text-[9px] font-mono text-[var(--color-text-muted)] group-hover:text-[var(--color-text)] transition-colors uppercase">Remember Me</span>
              </label>
              <a href="/forgot-password" class="text-[9px] font-mono text-[var(--color-primary)] hover:underline uppercase">Forgot Password?</a>
            </div>

            <PixelButton type="submit" variant="primary" class="w-full" loading={loading}>
              Sign In
            </PixelButton>
          </form>

          <div class="relative py-4">
            <div class="absolute inset-0 flex items-center"><div class="w-full border-t-2 border-black opacity-20"></div></div>
            <div class="relative flex justify-center text-[8px] font-display uppercase">
               <span class="px-2 bg-[var(--color-surface)]">External Login</span>
            </div>
          </div>

          <PixelButton variant="ghost" class="w-full text-xs" onclick={handleGitHubLogin}>
            {#snippet icon()}
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
            {/snippet}
            Continue with GitHub
          </PixelButton>

          <p class="text-center text-[9px] font-mono text-[var(--color-text-muted)] uppercase">
            New user? <a href="/register" class="text-[var(--color-primary)] font-bold hover:underline">Create Account</a>
          </p>
        </div>
      {/if}
    </IsometricCard>

    <p class="text-center mt-8 text-[8px] font-mono text-[var(--color-text-muted)] uppercase tracking-widest opacity-50">
      System Version 4.0.0 Stable
    </p>
  </div>
</div>
