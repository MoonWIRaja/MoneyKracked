<script lang="ts">
  interface Props {
    size?: 'sm' | 'md' | 'lg';
    label?: string;
  }
  
  let { size = 'md', label }: Props = $props();
  
  const sizeClasses = {
    sm: 'w-6 h-6 border-2',
    md: 'w-10 h-10 border-4',
    lg: 'w-16 h-16 border-4'
  };
</script>

<div class="flex flex-col items-center gap-3">
  <div class="relative {sizeClasses[size]} border-black bg-[var(--color-primary)] shadow-[2px_2px_0px_0px_var(--color-shadow)] animate-bounce">
    <div class="absolute inset-1 bg-black/20 animate-pulse"></div>
  </div>
  {#if label}
    <p class="text-[10px] font-mono text-[var(--color-text-muted)] uppercase tracking-widest">{label}</p>
  {/if}
</div>
