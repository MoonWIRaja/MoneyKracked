<script lang="ts">
  import { Button, Input, Card } from '$lib/components/ui';
  import { authClient } from '$lib/auth-client';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  
  let identifier = $state(''); // Email or username
  let password = $state('');
  let error = $state('');
  let loading = $state(false);
  
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
      } else if (result?.data) {
        // Login successful, force full page redirect
        console.log('Login successful, redirecting...');
        setTimeout(() => {
          window.location.replace('/dashboard');
        }, 100);
      } else {
        error = 'Login failed. Please try again.';
      }
    } catch (err: any) {
      console.error('Login error:', err);
      error = err.message || 'An unexpected error occurred';
    } finally {
      loading = false;
    }
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
    </Card>
  </div>
</div>
