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
      } else {
        await goto('/dashboard');
      }
    } catch (err) {
      error = 'An unexpected error occurred';
    } finally {
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
    </Card>
  </div>
</div>
