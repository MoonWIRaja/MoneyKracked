<script lang="ts">
  import { onMount } from 'svelte';

  let loading = $state(true);
  let error = $state<string | null>(null);

  onMount(async () => {
    // Get token from URL search params
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (!token) {
      error = 'No session token provided';
      loading = false;
      return;
    }

    console.log('[Auth Callback] Got token, calling API to set session...');

    try {
      // Call API with token in header to set session cookie server-side
      const response = await fetch('/api/auth/validate-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        console.log('[Auth Callback] Session validated, redirecting to dashboard...');
        window.location.href = '/dashboard';
      } else {
        const result = await response.json();
        error = result.error || 'Failed to validate session';
        loading = false;
      }
    } catch (err) {
      console.error('[Auth Callback] Error:', err);
      error = 'Failed to connect to server';
      loading = false;
    }
  });
</script>

<div class="min-h-screen flex items-center justify-center bg-bg-dark">
  <div class="text-center">
    {#if loading}
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
      <p class="text-text-secondary">Logging you in...</p>
    {:else if error}
      <div class="text-red-500 mb-4">{error}</div>
      <a href="/login" class="text-primary hover:underline">Return to login</a>
    {/if}
  </div>
</div>
