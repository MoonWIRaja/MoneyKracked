<script lang="ts">
  import { PixelButton, Input, IsometricCard } from '$lib/components/ui';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  let name = $state('');
  let username = $state('');
  let email = $state('');
  let password = $state('');
  let confirmPassword = $state('');
  let error = $state('');
  let loading = $state(false);
  let showSuccess = $state(false);
  let successMessage = $state('');

  let resendCountdown = $state(0);
  let resendLoading = $state(false);
  let registeredEmail = $state('');
  let registeredName = $state('');
  let countdownInterval: ReturnType<typeof setInterval> | null = null;

  function startCountdown() {
    resendCountdown = 60;
    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(() => {
      resendCountdown--;
      if (resendCountdown <= 0 && countdownInterval) clearInterval(countdownInterval);
    }, 1000);
  }

  async function handleResendEmail() {
    if (resendCountdown > 0 || resendLoading || !registeredEmail) return;
    resendLoading = true;
    try {
      const response = await fetch('/api/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: registeredEmail })
      });
      const result = await response.json();
      if (result.success) startCountdown();
    } finally { resendLoading = false; }
  }

  async function handleRegister(e: Event) {
    e.preventDefault();
    error = '';
    if (password !== confirmPassword) { error = 'Passwords do not match'; return; }
    if (password.length < 8) { error = 'Password too short (8+ chars)'; return; }
    if (username.length < 3) { error = 'Username too short (3+ chars)'; return; }
    
    loading = true;
    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name, username })
      });
      const result = await response.json();
      if (result.success) {
        registeredEmail = email; registeredName = name;
        showSuccess = true; successMessage = 'Please check your email to verify your account';
        startCountdown();
      } else { error = result.error || 'Registration failed'; }
    } catch (err) { error = 'Network failure'; }
    finally { loading = false; }
  }
</script>

<svelte:head>
  <title>Register - MoneyKracked</title>
</svelte:head>

<div class="min-h-screen bg-[var(--color-bg)] flex flex-col items-center justify-center p-6 relative overflow-hidden">
  <div class="absolute inset-0 opacity-10 pointer-events-none" 
    style="background-image: radial-gradient(var(--color-primary) 1px, transparent 1px); background-size: 24px 24px;">
  </div>

  <div class="w-full max-w-sm relative z-10">
    <div class="text-center mb-10">
      <div class="inline-flex items-center justify-center w-20 h-20 border-4 border-black bg-[var(--color-primary)] shadow-[4px_4px_0px_0px_var(--color-shadow)] mb-4">
        <span class="material-symbols-outlined text-4xl text-black">person_add</span>
      </div>
      <h1 class="text-2xl font-display text-[var(--color-primary)] tracking-tight uppercase">MoneyKracked</h1>
      <p class="text-[10px] font-mono text-[var(--color-text-muted)] uppercase tracking-widest mt-1">Create Account</p>
    </div>

    <IsometricCard title={showSuccess ? "Success!" : "Join Now"}>
      {#if showSuccess}
        <div class="space-y-6 text-center py-4">
          <div class="inline-flex items-center justify-center w-16 h-16 border-4 border-black bg-[var(--color-primary)] shadow-[4px_4px_0px_0px_var(--color-shadow)] mb-2">
            <span class="material-symbols-outlined text-white animate-pulse">mail</span>
          </div>
          <p class="text-[10px] font-mono text-[var(--color-text)] uppercase">{successMessage}</p>
          
          <div class="p-4 bg-[var(--color-surface-raised)] border-4 border-black text-left space-y-2">
            <p class="text-[9px] font-display text-[var(--color-primary)] uppercase">Next Steps:</p>
            <ul class="text-[9px] font-mono uppercase space-y-1">
              <li class="flex items-center gap-2"><span class="w-2 h-2 bg-[var(--color-primary)]"></span> Check your inbox</li>
              <li class="flex items-center gap-2"><span class="w-2 h-2 bg-[var(--color-primary)]"></span> Click the verify link</li>
              <li class="flex items-center gap-2"><span class="w-2 h-2 bg-[var(--color-primary)]"></span> Log in to your account</li>
            </ul>
          </div>

          <div class="py-2">
              {#if resendCountdown > 0}
                <p class="text-[8px] font-mono text-[var(--color-text-muted)] uppercase">Resend available in: {resendCountdown}s</p>
              {:else}
                <button onclick={handleResendEmail} class="text-[9px] font-mono text-[var(--color-primary)] uppercase underline underline-offset-4 hover:no-underline">
                   {resendLoading ? 'Sending...' : 'Resend Email'}
                </button>
              {/if}
          </div>

          <PixelButton variant="primary" class="w-full text-xs" onclick={() => window.location.href = '/login'}>
            Go to Login
          </PixelButton>
        </div>
      {:else}
        <div class="space-y-6">
          {#if error}
            <div class="p-3 border-4 border-black bg-[var(--color-danger)] text-black text-[10px] font-mono uppercase">
               Error: {error}
            </div>
          {/if}

          <form onsubmit={handleRegister} class="space-y-4">
            <Input label="Full Name" bind:value={name} placeholder="Enter your name" required />
            <Input label="Username" bind:value={username} placeholder="Choose a username" required />
            <Input label="Email Address" type="email" bind:value={email} placeholder="Enter your email" required />
            <Input label="Password" type="password" bind:value={password} placeholder="••••••••" required />
            <Input label="Confirm Password" type="password" bind:value={confirmPassword} placeholder="••••••••" required />
            
            <p class="text-[8px] font-mono text-[var(--color-text-muted)] uppercase mt-2">
               By registering, you agree to our Terms and Privacy Policy.
            </p>

            <PixelButton type="submit" variant="primary" class="w-full text-xs" loading={loading}>
              Create Account
            </PixelButton>
          </form>

          <p class="text-center text-[9px] font-mono text-[var(--color-text-muted)] uppercase">
            Already a member? <a href="/login" class="text-[var(--color-primary)] font-bold hover:underline">Log In</a>
          </p>
        </div>
      {/if}
    </IsometricCard>

    <p class="text-center mt-8 text-[8px] font-mono text-[var(--color-text-muted)] uppercase tracking-widest opacity-50">
      System Ready 
    </p>
  </div>
</div>
