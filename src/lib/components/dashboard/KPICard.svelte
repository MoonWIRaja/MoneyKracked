<script lang="ts">
  import IsometricCard from '$lib/components/ui/IsometricCard.svelte';

  interface Props {
    title: string;
    value: string;
    trend?: {
      value: string;
      direction: 'up' | 'down';
      label: string;
    };
    icon: string;
    iconColor?: 'green' | 'orange' | 'red' | 'blue';
    valueColor?: 'default' | 'primary' | 'danger';
    clickable?: boolean;
    onclick?: () => void;
  }

  let {
    title,
    value,
    trend,
    icon,
    iconColor = 'green',
    valueColor = 'default',
    clickable = false,
    onclick
  }: Props = $props();

  const iconColors = {
    green: 'bg-[#4ade80] text-black border-black',
    orange: 'bg-[#fbbf24] text-black border-black',
    red: 'bg-[#f87171] text-black border-black',
    blue: 'bg-[#60a5fa] text-black border-black'
  };

  const valueColors = {
    default: 'text-[var(--color-text)]',
    primary: 'text-[var(--color-primary)]',
    danger: 'text-[var(--color-danger)]'
  };
</script>

<IsometricCard
  class="group {clickable ? 'cursor-pointer hover:-translate-y-1 transition-transform' : ''}"
>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div onclick={clickable ? onclick : undefined}>
    <div class="flex items-start justify-between">
      <div class="flex flex-col gap-1">
        <p class="text-xs font-mono text-[var(--color-text-muted)] tracking-widest uppercase">{title}</p>
        <h3 class="mt-1 text-2xl font-body font-bold tracking-tight {valueColors[valueColor]}">{value}</h3>
      </div>
      <div class="flex h-12 w-12 items-center justify-center border-2 border-[var(--color-border)] shadow-[2px_2px_0px_0px_var(--color-shadow)] {iconColors[iconColor]}">
        <span class="material-symbols-outlined">{icon}</span>
      </div>
    </div>

    {#if trend}
      <div class="mt-4 flex items-center gap-2 text-xs font-mono border-t-2 border-dashed border-[var(--color-border)] pt-2">
        <span class="flex items-center font-bold {trend.direction === 'up' ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]'}">
          <span class="material-symbols-outlined text-sm">
            {trend.direction === 'up' ? 'arrow_upward' : 'arrow_downward'}
          </span>
          {trend.value}
        </span>
        <span class="text-[var(--color-text-muted)]">{trend.label}</span>
      </div>
    {/if}
  </div>
</IsometricCard>
