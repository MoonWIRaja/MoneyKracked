<script lang="ts">
  interface Props {
    type?: 'text' | 'email' | 'password' | 'number' | 'date';
    name?: string;
    id?: string;
    placeholder?: string;
    value?: string | number;
    label?: string;
    error?: string;
    required?: boolean;
    disabled?: boolean;
    class?: string;
    oninput?: (e: Event) => void;
    onchange?: (e: Event) => void;
  }
  
  let {
    type = 'text',
    name,
    id,
    placeholder,
    value = $bindable(''),
    label,
    error,
    required = false,
    disabled = false,
    class: className = '',
    oninput,
    onchange
  }: Props = $props();
  
  const inputId = $derived(id || name || crypto.randomUUID());
</script>

<div class="flex flex-col gap-1.5 {className}">
  {#if label}
    <label for={inputId} class="text-sm font-medium text-text-secondary">
      {label}
      {#if required}
        <span class="text-danger">*</span>
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
    {oninput}
    {onchange}
    class="
      w-full px-4 py-2.5 rounded-lg
      bg-bg-dark border border-border-dark
      text-white placeholder:text-text-muted
      focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
      disabled:opacity-50 disabled:cursor-not-allowed
      transition-all duration-200
      {error ? 'border-danger focus:ring-danger' : ''}
    "
  />
  
  {#if error}
    <p class="text-xs text-danger flex items-center gap-1">
      <span class="material-symbols-outlined text-sm">error</span>
      {error}
    </p>
  {/if}
</div>
