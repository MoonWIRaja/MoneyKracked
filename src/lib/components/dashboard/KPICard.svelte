<script lang="ts">
  import { Card } from '$lib/components/ui';
  
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
  }
  
  let {
    title,
    value,
    trend,
    icon,
    iconColor = 'green',
    valueColor = 'default'
  }: Props = $props();
  
  const iconColors = {
    green: 'bg-primary/20 text-primary',
    orange: 'bg-warning/20 text-warning',
    red: 'bg-danger/20 text-danger',
    blue: 'bg-info/20 text-info'
  };
  
  const valueColors = {
    default: 'text-white',
    primary: 'text-primary',
    danger: 'text-danger'
  };
</script>

<Card class="group">
  <div class="flex items-start justify-between">
    <div>
      <p class="text-sm font-medium text-text-secondary">{title}</p>
      <h3 class="mt-2 text-2xl font-bold tracking-tight {valueColors[valueColor]}">{value}</h3>
    </div>
    <div class="flex h-10 w-10 items-center justify-center rounded-full {iconColors[iconColor]}">
      <span class="material-symbols-outlined">{icon}</span>
    </div>
  </div>
  
  {#if trend}
    <div class="mt-4 flex items-center gap-2 text-xs">
      <span class="flex items-center font-medium {trend.direction === 'up' ? 'text-danger' : 'text-success'}">
        <span class="material-symbols-outlined text-sm">
          {trend.direction === 'up' ? 'arrow_upward' : 'arrow_downward'}
        </span>
        {trend.value}
      </span>
      <span class="text-text-muted">{trend.label}</span>
    </div>
  {/if}
</Card>
