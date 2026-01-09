<script lang="ts">
  import { Button, Card, Input } from '$lib/components/ui';
  import { goto } from '$app/navigation';

  let email = $state('');
  let loading = $state(false);
  let success = $state(false);
  let error = $state('');

  async function handleForgotPassword() {
    if (!email) {
      error = 'Please enter your email address';
      return;
    }

    loading = true;
    error = '';

    try {
      const response = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (response.ok) {
        success = true;
      } else {
        throw new Error(data.error || 'Failed to send reset email');
      }
    } catch (err: any) {
      error = err.message || 'Something went wrong. Please try again.';
    } finally {
      loading = false;
    }
  }

  function goToLogin() {
    goto('/login');
  }
</script>

<svelte:head>
  <title>Forgot Password - MoneyKracked</title>
</svelte:head>

<div class="min-h-screen bg-bg-dark flex items-center justify-center p-4">
  <div class="w-full max-w-md">
    <!-- Brand Header -->
    <div class="text-center mb-8">
      <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/20 text-primary mb-4">
        <span class="material-symbols-outlined text-3xl">lock_reset</span>
      </div>
      <h1 class="text-2xl font-bold text-white">MoneyKracked</h1>
    </div>

    <Card>
      {#if !success}
        <!-- Forgot Password Form -->
        <div class="text-center mb-6">
          <h2 class="text-xl font-bold text-white mb-2">Forgot Your Password?</h2>
          <p class="text-text-muted text-sm">
            Enter your email address and we'll send you a link to reset your password.
          </p>
        </div>

        {#if error}
          <div class="mb-4 p-3 bg-danger/10 border border-danger/30 rounded-lg text-danger text-sm">
            {error}
          </div>
        {/if}

        <div class="space-y-4">
          <Input
            label="Email Address"
            type="email"
            bind:value={email}
            placeholder="Enter your email"
            onkeydown={(e) => e.key === 'Enter' && handleForgotPassword()}
            disabled={loading}
          />

          <Button
            class="w-full"
            onclick={handleForgotPassword}
            disabled={loading}
            loading={loading}
          >
            {loading ? 'Sending...' : 'Send Reset Link'}
          </Button>

          <button
            onclick={goToLogin}
            class="w-full text-sm text-text-muted hover:text-white transition-colors"
          >
            Back to Login
          </button>
        </div>
      {:else}
        <!-- Success Message -->
        <div class="text-center py-6">
          <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success/20 text-success mb-4">
            <span class="material-symbols-outlined text-3xl">email</span>
          </div>
          <h2 class="text-xl font-bold text-white mb-2">Check Your Email</h2>
          <p class="text-text-muted text-sm mb-6">
            We've sent a password reset link to <strong class="text-white">{email}</strong>.
          </p>
          <div class="p-4 bg-bg-dark rounded-lg border border-border-dark text-sm text-text-muted mb-6">
            <p class="mb-2">The link will expire in 1 hour.</p>
            <p>If you don't see the email, check your spam folder.</p>
          </div>
          <Button variant="secondary" onclick={goToLogin}>
            Back to Login
          </Button>
        </div>
      {/if}
    </Card>
  </div>
</div>
