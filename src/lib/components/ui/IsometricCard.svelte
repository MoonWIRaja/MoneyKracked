<script lang="ts">
  import type { Snippet } from 'svelte';

  let { 
    children, 
    title = '', 
    class: className = '' 
  }: { 
    children: Snippet, 
    title?: string, 
    class?: string 
  } = $props();
</script>

<div class="iso-card p-4 md:p-6 rounded-none {className}">
  {#if title}
    <div class="mb-4 border-b-2 border-dashed border-[var(--color-border)] pb-2">
      <h3 class="text-sm md:text-base m-0 tracking-wider text-[var(--color-primary)]">
        {title}
      </h3>
    </div>
  {/if}
  
  <div class="content">
    {@render children()}
  </div>
</div>

<style>
  /* Ensure content respects the blocky layout */
  .content {
    font-family: var(--font-body);
  }
</style>
