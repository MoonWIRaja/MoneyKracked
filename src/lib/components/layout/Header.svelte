<script lang="ts">
  import { PixelButton } from '$lib/components/ui';

  interface Props {
    title: string;
    subtitle?: string;
    showDatePicker?: boolean;
    showAddButton?: boolean;
    onAddClick?: () => void;
  }

  let {
    title,
    subtitle,
    showDatePicker = false,
    showAddButton = false,
    onAddClick
  }: Props = $props();

  // Get current month/year
  const currentDate = new Date();
  const monthYear = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
</script>

<header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between py-4">
  <div>
    <h2 class="text-xl md:text-2xl lg:text-3xl font-display text-[var(--color-primary)] uppercase tracking-tight">{title}</h2>
    {#if subtitle}
      <p class="mt-2 text-sm text-[var(--color-text-muted)] font-mono max-w-md leading-relaxed">{subtitle}</p>
    {/if}
  </div>
  
  {#if showDatePicker || showAddButton}
    <div class="flex items-center gap-4">
      {#if showDatePicker}
        <div class="hidden sm:flex items-center gap-2 border-2 border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 shadow-[2px_2px_0px_0px_var(--color-shadow)]">
          <span class="material-symbols-outlined text-[var(--color-primary)]">calendar_month</span>
          <span class="font-display text-xs text-[var(--color-text)]">{monthYear}</span>
        </div>
      {/if}
      
      {#if showAddButton}
        <PixelButton onclick={onAddClick} variant="primary">
          <span class="material-symbols-outlined text-lg">add</span>
          <span>Add Transaction</span>
        </PixelButton>
      {/if}
    </div>
  {/if}
</header>
