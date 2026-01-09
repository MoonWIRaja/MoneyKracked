<script lang="ts">
  import { Button, Card, Input } from '$lib/components/ui';
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
    // Get token from URL query params
    const urlToken = $page.url.searchParams.get('token');
    if (!urlToken) {
      isValidToken = false;
      error = 'Invalid reset link. Please request a new password reset.';
    }
    token = urlToken || '';
  });

  async function handleResetPassword() {
    if (!newPassword || !confirmPassword) {
      error = 'Please fill in all fields';
      return;
    }

    if (newPassword.length < 8) {
      error = 'Password must be at least 8 characters long';
      return;
    }

    if (newPassword !== confirmPassword) {
      error = 'Passwords do not match';
      return;
    }

    loading = true;
    error = '';

    try {
      const response = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword })
      });

      const data = await response.json();

      if (response.ok) {
        success = true;
      } else {
        throw new Error(data.error || 'Failed to reset password');
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
  <title>Reset Password - MoneyKracked</title>
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
      {#if !isValidToken}
        <!-- Invalid Token -->
        <div class="text-center py-6">
          <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-danger/20 text-danger mb-4">
            <span class="material-symbols-outlined text-3xl">error</span>
          </div>
          <h2 class="text-xl font-bold text-white mb-2">Invalid Reset Link</h2>
          <p class="text-text-muted text-sm mb-6">
            This password reset link is invalid or has expired.
          </p>
          <div class="space-y-3">
            <Button class="w-full" onclick={() => goto('/forgot-password')}>
              Request New Reset Link
            </Button>
            <Button variant="secondary" class="w-full" onclick={goToLogin}>
              Back to Login
            </Button>
          </div>
        </div>

      {:else if !success}
        <!-- Reset Password Form -->
        <div class="text-center mb-6">
          <h2 class="text-xl font-bold text-white mb-2">Reset Your Password</h2>
          <p class="text-text-muted text-sm">
            Enter your new password below.
          </p>
        </div>

        {#if error}
          <div class="mb-4 p-3 bg-danger/10 border border-danger/30 rounded-lg text-danger text-sm">
            {error}
          </div>
        {/if}

        <div class="space-y-4">
          <Input
            label="New Password"
            type="password"
            bind:value={newPassword}
            placeholder="Enter new password (min. 8 characters)"
            onkeydown={(e) => e.key === 'Enter' && handleResetPassword()}
            disabled={loading}
          />

          <Input
            label="Confirm New Password"
            type="password"
            bind:value={confirmPassword}
            placeholder="Confirm your new password"
            onkeydown={(e) => e.key === 'Enter' && handleResetPassword()}
            disabled={loading}
          />

          <div class="p-3 bg-bg-dark rounded-lg border border-border-dark text-xs text-text-muted">
            <p class="font-medium text-white mb-1">Password requirements:</p>
            <ul class="list-disc list-inside space-y-1">
              <li>At least 8 characters long</li>
              <li>Should be different from your current password</li>
            </ul>
          </div>

          <Button
            class="w-full"
            onclick={handleResetPassword}
            disabled={loading}
            loading={loading}
          >
            {loading ? 'Resetting...' : 'Reset Password'}
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
            <span class="material-symbols-outlined text-3xl">check_circle</span>
          </div>
          <h2 class="text-xl font-bold text-white mb-2">Password Reset Successful!</h2>
          <p class="text-text-muted text-sm mb-6">
            Your password has been successfully reset. You can now login with your new password.
          </p>
          <Button class="w-full" onclick={goToLogin}>
            Go to Login
          </Button>
        </div>
      {/if}
    </Card>
  </div>
</div>
