<script lang="ts">
  import { Card, Button } from '$lib/components/ui';
  
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

<Card padding="lg" class="flex flex-col">
  <div class="mb-4 flex items-center justify-between">
    <h3 class="text-lg font-bold text-white">Recent Expenses</h3>
    <a href="/transactions" class="text-sm font-medium text-primary hover:text-primary-hover transition-colors">
      View All
    </a>
  </div>
  
  <div class="flex flex-col gap-4">
    {#each expenses as expense}
      <div class="flex items-center justify-between border-b border-border-dark pb-3 last:border-0 last:pb-0">
        <div class="flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded-lg {expense.iconBg} {expense.iconColor}">
            <span class="material-symbols-outlined text-xl">{expense.icon}</span>
          </div>
          <div>
            <p class="text-sm font-bold text-white">{expense.payee}</p>
            <p class="text-xs text-text-muted">{formatDate(expense.date)}</p>
          </div>
        </div>
        <span class="text-sm font-bold text-white">-{currency} {formatAmount(expense.amount)}</span>
      </div>
    {/each}
  </div>
  
  <Button variant="secondary" class="mt-6 w-full">
    {#snippet icon()}
      <span class="material-symbols-outlined text-lg">history</span>
    {/snippet}
    View Transaction History
  </Button>
</Card>
