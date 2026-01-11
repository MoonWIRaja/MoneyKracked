<script lang="ts">
  import { page } from '$app/stores';

  interface Props {
    user: {
      name: string;
      email: string;
      image?: string | null;
    } | null;
    mobileOpen?: boolean;
    onClose?: () => void;
  }

  let { user, mobileOpen = false, onClose }: Props = $props();
  let showProfileDrawer = $state(false);

  // Navigation items
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

  function handleLogout() {
    window.location.href = '/api/logout';
  }
  
  function toggleProfileDrawer() {
    showProfileDrawer = !showProfileDrawer;
  }
  
  function closeDrawer() {
    showProfileDrawer = false;
  }
</script>

<aside
  class="fixed inset-y-0 left-0 z-50 w-64 flex flex-col border-r-4 border-[var(--color-border)] bg-[var(--color-surface)] transition-transform duration-300 lg:static lg:flex lg:translate-x-0
  {mobileOpen ? 'translate-x-0' : '-translate-x-full'}"
>
  <div class="flex flex-col h-full justify-between p-4">
    <!-- Top Section -->
    <div class="flex flex-col gap-8">
      <!-- Brand -->
        <a href="/dashboard" class="flex items-center gap-3 px-2 group">
          <img src="/logo.png" alt="MoneyKracked" class="h-12 w-auto object-contain group-hover:scale-105 transition-transform" style="image-rendering: pixelated;" />
          <div class="flex flex-col">
            <h1 class="text-xs font-bold leading-tight text-[var(--color-primary)] font-display tracking-tight uppercase group-hover:text-[var(--color-text)] transition-colors">Money<br>Kracked</h1>
          </div>
        </a>
      
      <!-- Navigation -->
      <nav class="flex flex-col gap-3">
        {#each navItems as item}
          {@const active = isActive(item.href)}
          <a
            href={item.href}
            onclick={onClose}
            class="flex items-center gap-3 px-3 py-3 text-sm font-medium transition-all duration-100 border-2 select-none
              {active 
                ? 'bg-[var(--color-primary)] text-black border-[var(--color-border)] shadow-[4px_4px_0px_0px_var(--color-shadow)] -translate-y-1' 
                : 'text-[var(--color-text-muted)] border-transparent hover:border-[var(--color-border)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text)]'}"
          >
            <span 
              class="material-symbols-outlined text-xl"
              style={active ? "font-variation-settings: 'FILL' 1;" : ''}
            >{item.icon}</span>
            <span class="font-mono text-sm tracking-widest uppercase">{item.label}</span>
          </a>
        {/each}
      </nav>
    </div>
    
      <!-- User Profile Button -->
      <div class="relative border-t-2 border-dashed border-[var(--color-border)] pt-4">
        {#if user}
          <button
            onclick={toggleProfileDrawer}
            class="w-full flex items-center gap-3 p-2 hover:bg-[var(--color-surface-raised)] border-2 border-transparent hover:border-[var(--color-border)] transition-all text-left group"
          >
            {#if user.image}
              <img src={user.image} alt={user.name} class="h-10 w-10 border-2 border-[var(--color-border)] object-cover" />
            {:else}
              <div class="h-10 w-10 border-2 border-[var(--color-border)] bg-[var(--color-secondary)] flex items-center justify-center text-white font-bold">
                {user.name?.charAt(0).toUpperCase() || 'U'}
              </div>
            {/if}
            <div class="flex-1 overflow-hidden group-hover:translate-x-1 transition-transform">
              <p class="truncate text-sm font-bold text-[var(--color-text)] font-display">{user.name}</p>
              <p class="truncate text-xs text-[var(--color-text-muted)] font-mono">{user.email}</p>
            </div>
            <span class="material-symbols-outlined text-[var(--color-text-muted)]">
              {showProfileDrawer ? 'expand_less' : 'expand_more'}
            </span>
          </button>
          
          <!-- Profile Drawer -->
          {#if showProfileDrawer}
             <!-- svelte-ignore a11y_click_events_have_key_events -->
             <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="absolute bottom-full left-0 right-0 mb-4 bg-[var(--color-surface)] border-2 border-[var(--color-border)] shadow-[8px_8px_0px_0px_var(--color-shadow)] z-50 rounded-tr-lg rounded-tl-lg">
              <!-- Menu Options -->
              <div class="p-2 flex flex-col gap-2">
                <a
                  href="/settings"
                  onclick={() => { closeDrawer(); onClose?.(); }}
                  class="flex items-center gap-3 px-3 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-primary)] hover:text-black border-2 border-transparent hover:border-[var(--color-border)] transition-colors"
                >
                  <span class="material-symbols-outlined text-xl">settings</span>
                  <span class="font-display text-xs">Settings</span>
                </a>

                <button
                  onclick={handleLogout}
                  class="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger)] hover:text-white border-2 border-transparent hover:border-[var(--color-border)] transition-colors"
                >
                  <span class="material-symbols-outlined text-xl">logout</span>
                  <span class="font-display text-xs">Log Out</span>
                </button>
              </div>
            </div>
            
            <!-- Backdrop (Desktop) -->
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div 
              class="fixed inset-0 z-40 bg-black/0 cursor-default" 
              onclick={closeDrawer}
            ></div>
          {/if}
        {:else}
          <a
            href="/login"
            class="iso-btn w-full justify-center"
          >
            <span class="material-symbols-outlined">login</span>
            <span>Sign In</span>
          </a>
        {/if}
      </div>
    </div>
</aside>
