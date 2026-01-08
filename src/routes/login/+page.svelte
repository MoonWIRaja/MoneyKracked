<script lang="ts">
  import { Button, Input, Card } from '$lib/components/ui';
  import { authClient } from '$lib/auth-client';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';

  let identifier = $state(''); // Email or username
  let password = $state('');
  let error = $state('');
  let loading = $state(false);

  // 2FA states
  let showTwoFactor = $state(false);
  let twoFactorCode = $state('');
  let pendingUserId = $state('');
  let useBackupCode = $state(false);

  // Check for OAuth error from URL params (returned after GitHub OAuth fails)
  $effect(() => {
    const urlError = $page.url.searchParams.get('error');
    if (urlError === 'oauth_failed') {
      error = 'GitHub login failed. Please try again or use email/password.';
    } else if (urlError === 'state_mismatch') {
      error = 'Authentication session expired. Please try again.';
    } else if (urlError === 'not_linked') {
      error = 'This GitHub account is not linked to any account. Please register first, then link GitHub in Settings.';
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
        // Login with email
        result = await authClient.signIn.email({
          email: identifier,
          password
        });
      } else {
        // Login with username
        result = await authClient.signIn.username({
          username: identifier,
          password
        });
      }

      console.log('Login result:', result);

      if (result?.error) {
        error = result.error.message || 'Login failed. Please check your credentials.';
        loading = false;
      } else if (result?.data) {
        const user = result.data.user;

        // Check if user has 2FA enabled by fetching from database
        // Better Auth doesn't include custom fields in the user object
        const twoFaResponse = await fetch('/api/2fa');
        const twoFaData = await twoFaResponse.json();

        if (twoFaData.enabled) {
          // Show 2FA verification screen
          pendingUserId = user.id;
          showTwoFactor = true;
          loading = false;
        } else {
          // Login successful, force full page redirect
          console.log('Login successful, redirecting...');
          setTimeout(() => {
            window.location.replace('/dashboard');
          }, 100);
        }
      } else {
        error = 'Login failed. Please try again.';
        loading = false;
      }
    } catch (err: any) {
      console.error('Login error:', err);
      error = err.message || 'An unexpected error occurred';
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
        body: JSON.stringify({
          userId: pendingUserId,
          code: twoFactorCode,
          isBackup: useBackupCode
        })
      });

      const result = await response.json();

      if (result.success) {
        // 2FA verified, redirect to dashboard
        console.log('2FA verified, redirecting...');
        setTimeout(() => {
          window.location.replace('/dashboard');
        }, 100);
      } else {
        error = result.error || 'Invalid verification code';
        loading = false;
      }
    } catch (err: any) {
      console.error('2FA verification error:', err);
      error = err.message || 'Verification failed';
      loading = false;
    }
  }

  function cancelTwoFactor() {
    showTwoFactor = false;
    twoFactorCode = '';
    pendingUserId = '';
    useBackupCode = false;
    error = '';
  }

  function handleTwoFactorSubmit(e: Event) {
    e.preventDefault();
    verifyTwoFactor();
  }

  async function handleGitHubLogin() {
    error = '';
    loading = true;
    // Redirect to unified GitHub OAuth endpoint in login mode
    window.location.href = '/api/github-oauth?mode=login&callbackURL=/dashboard';
  }
</script>

<svelte:head>
  <title>Login - MoneyKracked</title>
</svelte:head>

<div class="min-h-screen bg-bg-dark flex items-center justify-center p-4">
  <div class="w-full max-w-md">
    <!-- Brand Header -->
    <div class="text-center mb-8">
      <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/20 text-primary mb-4">
        <span class="material-symbols-outlined text-3xl">account_balance_wallet</span>
      </div>
      <h1 class="text-2xl font-bold text-white">MoneyKracked</h1>
      <p class="text-text-secondary mt-1">Smart Finance Dashboard</p>
    </div>

    <!-- Login Card -->
    <Card>
      {#if showTwoFactor}
        <!-- 2FA Verification Screen -->
        <h2 class="text-xl font-bold text-white mb-2">Two-Factor Authentication</h2>
        <p class="text-sm text-text-muted mb-6">Enter the verification code from your authenticator app</p>

        {#if error}
          <div class="mb-4 p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm flex items-start gap-2">
            <span class="material-symbols-outlined text-lg flex-shrink-0">error</span>
            <span>{error}</span>
          </div>
        {/if}

        <!-- Method Toggle -->
        <div class="flex gap-2 p-1 bg-bg-dark rounded-lg mb-6">
          <button
            type="button"
            class="flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors {!useBackupCode ? 'bg-primary text-white' : 'text-text-muted hover:text-white'}"
            onclick={() => { useBackupCode = false; twoFactorCode = ''; error = ''; }}
          >
            <span class="material-symbols-outlined text-sm align-middle mr-1">phonelink</span>
            Authenticator
          </button>
          <button
            type="button"
            class="flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors {useBackupCode ? 'bg-primary text-white' : 'text-text-muted hover:text-white'}"
            onclick={() => { useBackupCode = true; twoFactorCode = ''; error = ''; }}
          >
            <span class="material-symbols-outlined text-sm align-middle mr-1">backup</span>
            Backup Code
          </button>
        </div>

        <form onsubmit={handleTwoFactorSubmit} class="space-y-4">
          <div>
            <label for="two-factor-code" class="block text-sm font-medium text-white mb-2">
              {useBackupCode ? 'Enter backup code' : 'Enter 6-digit code'}
            </label>
            <input
              id="two-factor-code"
              type="text"
              inputmode={useBackupCode ? 'text' : 'numeric'}
              pattern={useBackupCode ? undefined : '[0-9]{6}'}
              maxlength={useBackupCode ? 8 : 6}
              bind:value={twoFactorCode}
              placeholder={useBackupCode ? 'XXXXXXXX' : '000000'}
              class="w-full bg-bg-dark border border-border-dark rounded-lg px-4 py-3 text-white text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-primary"
              required
              autocomplete="one-time-code"
            />
          </div>

          <div class="flex gap-3">
            <Button type="button" variant="secondary" class="flex-1" onclick={cancelTwoFactor}>
              Back
            </Button>
            <Button type="submit" class="flex-1" {loading}>
              Verify
            </Button>
          </div>
        </form>

        <p class="mt-4 text-xs text-text-muted text-center">
          Lost your authenticator and backup codes? Contact support for assistance.
        </p>
      {:else}
        <!-- Normal Login Screen -->
        <h2 class="text-xl font-bold text-white mb-6">Welcome back</h2>

        {#if error}
          <div class="mb-4 p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm flex items-start gap-2">
            <span class="material-symbols-outlined text-lg flex-shrink-0">error</span>
            <span>{error}</span>
          </div>
        {/if}

        <form onsubmit={handleLogin} class="space-y-4">
          <Input
            type="text"
            name="identifier"
            label="Email or Username"
            placeholder="you@example.com or username"
            bind:value={identifier}
            required
          />

          <Input
            type="password"
            name="password"
            label="Password"
            placeholder="••••••••"
            bind:value={password}
            required
          />

          <div class="flex items-center justify-between text-sm">
            <label class="flex items-center gap-2 text-text-secondary cursor-pointer">
              <input type="checkbox" class="rounded border-border-dark bg-bg-dark text-primary focus:ring-primary" />
              Remember me
            </label>
            <a href="/forgot-password" class="text-primary hover:underline">Forgot password?</a>
          </div>

          <Button type="submit" class="w-full" {loading}>
            Sign In
          </Button>
        </form>

        <!-- Divider -->
        <div class="relative my-6">
          <div class="absolute inset-0 flex items-center">
            <div class="w-full border-t border-border-dark"></div>
          </div>
          <div class="relative flex justify-center text-sm">
            <span class="px-4 bg-surface-dark text-text-muted">Or continue with</span>
          </div>
        </div>

        <!-- GitHub Login -->
        <Button variant="secondary" class="w-full" onclick={handleGitHubLogin}>
          {#snippet icon()}
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
          {/snippet}
          Continue with GitHub
        </Button>

        <!-- Note about GitHub -->
        <p class="mt-3 text-xs text-text-muted text-center">
          GitHub login only works if you've linked your account in Settings
        </p>

        <!-- Register Link -->
        <p class="mt-6 text-center text-sm text-text-secondary">
          Don't have an account?
          <a href="/register" class="text-primary font-medium hover:underline">Sign up</a>
        </p>
      {/if}
    </Card>
  </div>
</div>
