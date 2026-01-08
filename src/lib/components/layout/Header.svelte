<script lang="ts">
  import { Button } from '$lib/components/ui';
  
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

<header class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
  <div>
    <h2 class="text-3xl font-black tracking-tight text-white">{title}</h2>
    {#if subtitle}
      <p class="mt-1 text-base text-text-secondary">{subtitle}</p>
    {/if}
  </div>
  
  {#if showDatePicker || showAddButton}
    <div class="flex items-center gap-3">
      {#if showDatePicker}
        <div class="hidden sm:flex items-center rounded-lg bg-surface-dark border border-border-dark px-3 py-2 text-sm font-medium text-text-secondary">
          <span class="material-symbols-outlined mr-2 text-lg">calendar_month</span>
          {monthYear}
        </div>
      {/if}
      
      {#if showAddButton}
        <Button onclick={onAddClick}>
          {#snippet icon()}
            <span class="material-symbols-outlined text-lg">add</span>
          {/snippet}
          Add Transaction
        </Button>
      {/if}
    </div>
  {/if}
</header>
