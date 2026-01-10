<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    class?: string;
    padding?: 'none' | 'sm' | 'md' | 'lg';
    hover?: boolean;
    children?: Snippet;
    onclick?: () => void;
  }

  let {
    class: className = '',
    padding = 'md',
    hover = true,
    children,
    onclick
  }: Props = $props();

  const paddings = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8'
  };

  // Only make it keyboard-accessible if it has an onclick handler
  const isClickable = $derived(!!onclick);
</script>

{#if isClickable}
  <button
    type="button"
    class="w-full text-left bg-surface-dark rounded-xl shadow-sm border border-border-dark {hover ? 'transition-all duration-200 hover:shadow-md hover:border-border-dark/80' : ''} cursor-pointer {paddings[padding]} {className}"
    {onclick}
  >
    {#if children}
      {@render children()}
    {/if}
  </button>
{:else}
  <div
    class="bg-surface-dark rounded-xl shadow-sm border border-border-dark {hover ? 'transition-all duration-200 hover:shadow-md hover:border-border-dark/80' : ''} {paddings[padding]} {className}"
  >
    {#if children}
      {@render children()}
    {/if}
  </div>
{/if}

