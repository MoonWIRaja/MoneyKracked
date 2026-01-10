<script lang="ts">
  import type { Snippet } from 'svelte';
  
  interface Props {
    class?: string;
    padding?: 'none' | 'sm' | 'md' | 'lg';
    hover?: boolean;
    children?: Snippet;
    onclick?: () => void;
    role?: string;
    tabindex?: number;
    onkeydown?: (e: KeyboardEvent) => void;
  }
  
  let {
    class: className = '',
    padding = 'md',
    hover = true,
    children,
    onclick,
    role,
    tabindex,
    onkeydown
  }: Props = $props();
  
  const paddings = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8'
  };
</script>

<div 
  class="
    bg-surface-dark rounded-xl shadow-sm border border-border-dark
    {hover ? 'transition-all duration-200 hover:shadow-md hover:border-border-dark/80' : ''}
    {paddings[padding]}
    {className}
  "
  {onclick}
  {role}
  {tabindex}
  {onkeydown}
>
  {#if children}
    {@render children()}
  {/if}
</div>

