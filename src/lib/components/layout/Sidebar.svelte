<script lang="ts">
  import { page } from '$app/stores';
  import { signOut } from '$lib/auth-client';
  import { goto } from '$app/navigation';

  interface Props {
    user: {
      name: string;
      email: string;
      image?: string | null;
    } | null;
  }

  let { user }: Props = $props();
  let showProfileDrawer = $state(false);
  
  // Navigation items - removed Settings (moved to profile drawer)
  const navItems = [
    { href: '/dashboard', icon: 'dashboard', label: 'Dashboard' },
    { href: '/transactions', icon: 'receipt_long', label: 'Transactions' },
    { href: '/budget', icon: 'savings', label: 'Budget' },
    { href: '/reports', icon: 'pie_chart', label: 'Reports' },
    { href: '/coach', icon: 'smart_toy', label: 'AI Coach' }
  ];
  
  function isActive(href: string): boolean {
    return $page.url.pathname === href || $page.url.pathname.startsWith(href + '/');
  }
  
  async function handleLogout() {
    try {
      await signOut();
    } catch (err) {
      console.error('Better Auth signOut failed:', err);
    }
    // Also clear custom session cookie by making API call
    // Then do full page redirect to ensure all state is cleared
    window.location.href = '/api/logout';
  }
  
  function toggleProfileDrawer() {
    showProfileDrawer = !showProfileDrawer;
  }
  
  function closeDrawer() {
    showProfileDrawer = false;
  }
</script>

<aside class="hidden lg:flex w-64 flex-col border-r border-border-dark bg-surface-dark">
  <div class="flex flex-col h-full justify-between p-4">
    <!-- Top Section -->
    <div class="flex flex-col gap-6">
      <!-- Brand -->
      <div class="flex items-center gap-3 px-2">
        <div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-primary">
          <span class="material-symbols-outlined">account_balance_wallet</span>
        </div>
        <div class="flex flex-col">
          <h1 class="text-base font-bold leading-tight text-white">MoneyKracked</h1>
          <p class="text-xs text-text-muted">Manage wisely</p>
        </div>
      </div>
      
      <!-- Navigation -->
      <nav class="flex flex-col gap-1">
        {#each navItems as item}
          <a
            href={item.href}
            class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200
              {isActive(item.href) 
                ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                : 'text-text-secondary hover:text-white hover:bg-border-dark'}"
          >
            <span 
              class="material-symbols-outlined text-xl"
              style={isActive(item.href) ? "font-variation-settings: 'FILL' 1;" : ''}
            >{item.icon}</span>
            <span>{item.label}</span>
          </a>
        {/each}
      </nav>
    </div>
    
    <!-- Bottom Section: User Profile Button -->
    <div class="relative border-t border-border-dark pt-4">
      {#if user}
        <button
          onclick={toggleProfileDrawer}
          class="w-full flex items-center gap-3 rounded-lg p-2 hover:bg-border-dark transition-colors text-left"
        >
          {#if user.image}
            <img src={user.image} alt={user.name} class="h-10 w-10 rounded-full object-cover" />
          {:else}
            <div class="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold">
              {user.name?.charAt(0).toUpperCase() || 'U'}
            </div>
          {/if}
          <div class="flex-1 overflow-hidden">
            <p class="truncate text-sm font-medium text-white">{user.name}</p>
            <p class="truncate text-xs text-text-muted">{user.email}</p>
          </div>
          <span class="material-symbols-outlined text-text-muted text-lg">
            {showProfileDrawer ? 'expand_less' : 'expand_more'}
          </span>
        </button>
        
        <!-- Profile Drawer -->
        {#if showProfileDrawer}
          <div class="absolute bottom-full left-0 right-0 mb-2 rounded-2xl bg-surface-dark border border-border-dark shadow-2xl overflow-hidden">
            <!-- User Info Header -->
            <div class="p-4 border-b border-border-dark bg-gradient-to-r from-primary/10 to-primary/5">
              <div class="flex items-center gap-3">
                {#if user.image}
                  <img src={user.image} alt={user.name} class="h-14 w-14 rounded-full object-cover ring-2 ring-primary/30 flex-shrink-0" />
                {:else}
                  <div class="h-14 w-14 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-white text-xl font-bold shadow-lg flex-shrink-0">
                    {user.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                {/if}
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-bold text-white truncate">{user.name}</p>
                  <p class="text-xs text-text-muted truncate">{user.email}</p>
                </div>
              </div>
            </div>

            <!-- Menu Options -->
            <div class="p-2">
              <a
                href="/settings"
                onclick={closeDrawer}
                class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-text-secondary hover:text-white hover:bg-border-dark transition-all duration-200"
              >
                <span class="material-symbols-outlined text-xl">settings</span>
                <span>Settings</span>
              </a>

              <button
                onclick={handleLogout}
                class="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-text-secondary hover:text-danger hover:bg-danger/10 transition-all duration-200"
              >
                <span class="material-symbols-outlined text-xl">logout</span>
                <span>Log Out</span>
              </button>
            </div>
          </div>
        {/if}
      {:else}
        <a
          href="/login"
          class="flex items-center gap-3 rounded-lg px-3 py-2 text-text-secondary hover:text-white hover:bg-border-dark transition-colors"
        >
          <span class="material-symbols-outlined">login</span>
          <span class="text-sm font-medium">Sign In</span>
        </a>
      {/if}
    </div>
  </div>
</aside>

<!-- Click outside to close drawer -->
{#if showProfileDrawer}
  <button
    class="fixed inset-0 z-40 lg:hidden"
    onclick={closeDrawer}
    aria-label="Close profile menu"
  ></button>
{/if}
