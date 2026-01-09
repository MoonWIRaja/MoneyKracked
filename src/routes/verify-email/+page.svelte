<script lang="ts">
  import { Button, Card } from '$lib/components/ui';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';

  let status = $state<'loading' | 'success' | 'error'>('loading');
  let message = $state('');

  onMount(async () => {
    const token = $page.url.searchParams.get('token');

    if (!token) {
      status = 'error';
      message = 'Invalid verification link. Please request a new verification email.';
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
        message = data.message || 'Your email has been verified successfully!';
      } else {
        status = 'error';
        message = data.error || 'Verification failed. The link may have expired.';
      }
    } catch (error) {
      status = 'error';
      message = 'An error occurred while verifying your email. Please try again.';
    }
  });

  function goToLogin() {
    window.location.href = '/login';
  }

  function goToDashboard() {
    window.location.href = '/dashboard';
  }
</script>

<svelte:head>
  <title>Verify Email - MoneyKracked</title>
</svelte:head>

<div class="min-h-screen bg-bg-dark flex items-center justify-center p-4">
  <div class="w-full max-w-md">
    <!-- Brand Header -->
    <div class="text-center mb-8">
      <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/20 text-primary mb-4">
        {#if status === 'loading'}
          <span class="material-symbols-outlined text-3xl animate-spin">refresh</span>
        {:else if status === 'success'}
          <span class="material-symbols-outlined text-3xl">check_circle</span>
        {:else}
          <span class="material-symbols-outlined text-3xl">error</span>
        {/if}
      </div>
      <h1 class="text-2xl font-bold text-white">MoneyKracked</h1>
    </div>

    <Card>
      {#if status === 'loading'}
        <div class="text-center py-8">
          <h2 class="text-xl font-bold text-white mb-2">Verifying Your Email</h2>
          <p class="text-text-muted">Please wait while we verify your email address...</p>
        </div>
      {:else if status === 'success'}
        <div class="text-center py-8">
          <h2 class="text-xl font-bold text-white mb-2">Email Verified!</h2>
          <p class="text-text-muted mb-6">{message}</p>
          <div class="bg-success/10 border border-success/20 rounded-lg p-4 mb-6">
            <p class="text-success text-sm">You can now sign in to your account.</p>
          </div>
          <Button class="w-full" onclick={goToLogin}>Go to Login</Button>
        </div>
      {:else}
        <div class="text-center py-8">
          <h2 class="text-xl font-bold text-white mb-2">Verification Failed</h2>
          <p class="text-text-muted mb-6">{message}</p>
          <div class="bg-danger/10 border border-danger/20 rounded-lg p-4 mb-6">
            <p class="text-danger text-sm">
              The verification link may have expired or is invalid. Please request a new verification email.
            </p>
          </div>
          <div class="space-y-3">
            <Button class="w-full" variant="secondary" onclick={goToLogin}>Back to Login</Button>
          </div>
        </div>
      {/if}
    </Card>
  </div>
</div>
