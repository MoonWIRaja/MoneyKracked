<script lang="ts">
  import { Button, Input, Card } from '$lib/components/ui';
  import { signUp } from '$lib/auth-client';
  import { goto } from '$app/navigation';

  let name = $state('');
  let username = $state('');
  let email = $state('');
  let password = $state('');
  let confirmPassword = $state('');
  let error = $state('');
  let loading = $state(false);
  let showSuccess = $state(false);
  let successMessage = $state('');

  async function handleRegister(e: Event) {
    e.preventDefault();
    error = '';

    if (password !== confirmPassword) {
      error = 'Passwords do not match';
      return;
    }

    if (password.length < 8) {
      error = 'Password must be at least 8 characters';
      return;
    }

    if (username.length < 3) {
      error = 'Username must be at least 3 characters';
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      error = 'Username can only contain letters, numbers, and underscores';
      return;
    }

    loading = true;

    try {
      const result = await signUp.email({
        email,
        password,
        name,
        username
      } as any);

      if (result.error) {
        error = result.error.message || 'Registration failed';
        loading = false;
      } else {
        // Registration successful, check if email verification is required
        if (result.data?.user?.emailVerified === false) {
          // Email verification required
          showSuccess = true;
          successMessage = 'Registration successful! Please check your email to verify your account.';
          loading = false;
        } else {
          // No verification required, redirect to dashboard
          await goto('/dashboard');
        }
      }
    } catch (err: any) {
      error = err.message || 'An unexpected error occurred';
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>Register - MoneyKracked</title>
</svelte:head>

<div class="min-h-screen bg-bg-dark flex items-center justify-center p-4">
  <div class="w-full max-w-md">
    <!-- Brand Header -->
    <div class="text-center mb-8">
      <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/20 text-primary mb-4">
        <span class="material-symbols-outlined text-3xl">account_balance_wallet</span>
      </div>
      <h1 class="text-2xl font-bold text-white">MoneyKracked</h1>
      <p class="text-text-secondary mt-1">Create your account</p>
    </div>
    
    <!-- Register Card -->
    <Card>
      {#if showSuccess}
        <!-- Success Message -->
        <div class="text-center py-8">
          <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success/20 text-success mb-4">
            <span class="material-symbols-outlined text-3xl">email</span>
          </div>
          <h2 class="text-xl font-bold text-white mb-2">Check Your Email</h2>
          <p class="text-text-muted mb-6">{successMessage}</p>
          <div class="bg-success/10 border border-success/20 rounded-lg p-4 mb-6 text-left">
            <p class="text-success text-sm font-medium mb-2">What's next?</p>
            <ol class="text-success text-sm space-y-1 list-decimal list-inside">
              <li>Check your email inbox</li>
              <li>Find the verification email from MoneyKracked</li>
              <li>Click the verification link</li>
              <li>Sign in with your credentials</li>
            </ol>
          </div>
          <p class="text-xs text-text-muted mb-4">
            Didn't receive the email? Check your spam folder or <a href="/register" class="text-primary hover:underline">try again</a>.
          </p>
          <Button variant="secondary" class="w-full" onclick={() => window.location.href = '/login'}>
            Go to Login
          </Button>
        </div>
      {:else}
        <h2 class="text-xl font-bold text-white mb-6">Get Started</h2>

        {#if error}
          <div class="mb-4 p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm flex items-center gap-2">
            <span class="material-symbols-outlined text-lg">error</span>
            {error}
          </div>
        {/if}

        <form onsubmit={handleRegister} class="space-y-4">
        <Input
          type="text"
          name="name"
          label="Full Name"
          placeholder="Alex Morgan"
          bind:value={name}
          required
        />
        
        <Input
          type="text"
          name="username"
          label="Username"
          placeholder="alexmorgan"
          bind:value={username}
          required
        />
        
        <Input
          type="email"
          name="email"
          label="Email"
          placeholder="you@example.com"
          bind:value={email}
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
        
        <Input
          type="password"
          name="confirmPassword"
          label="Confirm Password"
          placeholder="••••••••"
          bind:value={confirmPassword}
          required
        />
        
        <p class="text-xs text-text-muted">
          By registering, you agree to our 
          <a href="/terms" class="text-primary hover:underline">Terms of Service</a> and 
          <a href="/privacy" class="text-primary hover:underline">Privacy Policy</a>.
        </p>
        
        <Button type="submit" class="w-full" {loading}>
          Create Account
        </Button>
      </form>

      <!-- Login Link -->
      <p class="mt-6 text-center text-sm text-text-secondary">
        Already have an account?
        <a href="/login" class="text-primary font-medium hover:underline">Sign in</a>
      </p>
      {/if}
    </Card>
  </div>
</div>
