<script lang="ts">
  import type { Snippet } from 'svelte';
  
  interface Props {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    disabled?: boolean;
    loading?: boolean;
    type?: 'button' | 'submit' | 'reset';
    class?: string;
    onclick?: () => void;
    children: Snippet;
    icon?: Snippet;
  }
  
  let {
    variant = 'primary',
    size = 'md',
    disabled = false,
    loading = false,
    type = 'button',
    class: className = '',
    onclick,
    children,
    icon
  }: Props = $props();
  
  const baseStyles = `
    inline-flex items-center justify-center gap-2 font-semibold
    rounded-lg transition-all duration-200 ease-out
    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg-dark
    disabled:opacity-50 disabled:cursor-not-allowed
  `;
  
  const variants = {
    primary: 'bg-primary text-white hover:bg-primary-hover focus:ring-primary shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 hover:scale-[1.02] active:scale-[0.98]',
    secondary: 'bg-surface-dark text-white border border-border-dark hover:bg-border-dark focus:ring-primary',
    ghost: 'text-text-secondary hover:text-white hover:bg-surface-dark focus:ring-primary',
    danger: 'bg-danger text-white hover:bg-red-600 focus:ring-danger'
  };
  
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base'
  };
</script>

<button
  {type}
  {disabled}
  class="{baseStyles} {variants[variant]} {sizes[size]} {className}"
  onclick={onclick}
>
  {#if loading}
    <span class="material-symbols-outlined animate-spin text-lg">progress_activity</span>
  {:else if icon}
    {@render icon()}
  {/if}
  {@render children()}
</button>
