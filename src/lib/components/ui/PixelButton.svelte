<script lang="ts">
  import type { Snippet } from 'svelte';

  let { 
    children, 
    onclick, 
    type = "button", 
    class: className = '',
    variant = 'primary',
    disabled = false,
    loading = false,
    icon
  }: { 
    children: Snippet, 
    onclick?: (e: MouseEvent) => void, 
    type?: "button" | "submit" | "reset",
    class?: string,
    variant?: 'primary' | 'secondary' | 'accent' | 'danger' | 'ghost',
    disabled?: boolean,
    loading?: boolean,
    icon?: Snippet
  } = $props();

  const variantMap = {
    primary: 'bg-[var(--color-primary)] text-black hover:bg-[var(--color-primary)]',
    secondary: 'bg-[var(--color-secondary)] text-white',
    accent: 'bg-[var(--color-accent)] text-white',
    danger: 'bg-[var(--color-danger)] text-white',
    ghost: 'bg-transparent border-transparent shadow-none hover:shadow-none hover:bg-[var(--color-surface-raised)] text-[var(--color-text)]'
  };

  // Derived style to avoid captured initial value warning
  const selectedVariant = $derived(variantMap[variant] || variantMap.primary);
</script>

<button
  {type}
  onclick={(e) => !loading && onclick?.(e)}
  class="iso-btn {selectedVariant} {className} {loading ? 'opacity-70 cursor-wait' : ''}"
  disabled={disabled || loading}
>
  <div class="flex items-center justify-center gap-2">
    {#if loading}
      <span class="material-symbols-outlined text-sm animate-spin">refresh</span>
    {:else if icon}
      {@render icon()}
    {/if}
    <span class="truncate">
      {@render children()}
    </span>
  </div>
</button>
