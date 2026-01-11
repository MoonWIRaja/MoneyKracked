<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';

  interface Props extends HTMLInputAttributes {
    type?: 'text' | 'email' | 'password' | 'number' | 'date';
    label?: string;
    error?: string;
    value?: string | number;
    class?: string;
  }
  
  let {
    type = 'text',
    label,
    error,
    value = $bindable(''),
    class: className = '',
    placeholder,
    required = false,
    disabled = false,
    id,
    name,
    ...rest
  }: Props = $props();
  
  const inputId = $derived(id || name || crypto.randomUUID());
</script>

<div class="flex flex-col gap-1.5 {className}">
  {#if label}
    <label for={inputId} class="text-[10px] font-mono text-[var(--color-text-muted)] uppercase tracking-widest mb-0.5">
      {label}
      {#if required}
        <span class="text-[var(--color-danger)] ml-1">*</span>
      {/if}
    </label>
  {/if}
  
  <input
    {type}
    {name}
    id={inputId}
    {placeholder}
    bind:value
    {required}
    {disabled}
    class="
      w-full px-4 py-3 border-4 border-black bg-[var(--color-bg)]
      text-[var(--color-text)] font-mono text-base placeholder:text-[var(--color-text-muted)]
      shadow-[inset_4px_4px_0px_0px_rgba(0,0,0,0.2)]
      focus:outline-none focus:border-[var(--color-primary)]
      disabled:opacity-50 disabled:cursor-not-allowed
      transition-all
      {error ? 'border-[var(--color-danger)]' : ''}
    "
    {...rest}
  />
  
  {#if error}
    <p class="text-[10px] text-[var(--color-danger)] font-mono uppercase flex items-center gap-1 mt-1">
      <span class="material-symbols-outlined text-xs">error</span>
      {error}
    </p>
  {/if}
</div>
