<script lang="ts">
  import { IsometricCard, PixelButton } from '$lib/components/ui';
  
  interface Expense {
    id: string;
    payee: string;
    amount: number;
    date: string;
    icon: string;
    iconColor: string;
    iconBg: string;
  }
  
  interface Props {
    expenses: Expense[];
    currency?: string;
  }
  
  let { expenses, currency = 'Rp' }: Props = $props();
  
  function formatAmount(amount: number): string {
    return new Intl.NumberFormat('id-ID').format(amount);
  }
  
  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return `Today, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
    } else if (days === 1) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  }
</script>

<IsometricCard title="Recent Expenses" class="flex flex-col h-full">
  <div class="flex flex-col gap-4">
    {#each expenses as expense}
      <div class="flex items-center justify-between border-b-2 border-dashed border-[var(--color-border)] pb-3 last:border-0 last:pb-0">
        <div class="flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center border-2 border-[var(--color-border)] shadow-[2px_2px_0px_0px_var(--color-shadow)] {expense.iconBg} {expense.iconColor}">
            <span class="material-symbols-outlined text-xl">{expense.icon}</span>
          </div>
          <div>
            <p class="text-sm font-bold text-[var(--color-text)] font-ui">{expense.payee}</p>
            <p class="text-xs text-[var(--color-text-muted)] font-mono">{formatDate(expense.date)}</p>
          </div>
        </div>
        <span class="text-sm font-bold text-[var(--color-text)] font-mono">-{currency} {formatAmount(expense.amount)}</span>
      </div>
    {/each}
  </div>
  
  <div class="mt-6">
    <a href="/transactions" class="text-decoration-none w-full block">
        <PixelButton variant="ghost" class="w-full justify-center">
            <span class="material-symbols-outlined text-lg">history</span>
            <span>View All History</span>
        </PixelButton>
    </a>
  </div>
</IsometricCard>
