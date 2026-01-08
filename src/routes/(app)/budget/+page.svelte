<script lang="ts">
  import { Header } from '$lib/components/layout';
  import { Card, Button, Input } from '$lib/components/ui';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  
  // Currency settings
  const currencies: Record<string, { symbol: string; name: string; locale: string }> = {
    'MYR': { symbol: 'RM', name: 'Malaysian Ringgit', locale: 'en-MY' },
    'SGD': { symbol: 'S$', name: 'Singapore Dollar', locale: 'en-SG' },
    'USD': { symbol: '$', name: 'US Dollar', locale: 'en-US' }
  };
  
  let selectedCurrency = $state('MYR');
  
  interface Budget {
    id: string;
    categoryId?: string;
    categoryName: string;
    categoryIcon: string;
    categoryColor: string;
    limitAmount: number;
    period?: string;
    spent: number;
    month?: number;
    year?: number;
  }
  
  let budgets = $state<Budget[]>([]);
  let loading = $state(true);
  let error = $state('');
  
  // Month/Year selector
  const currentDate = new Date();
  let selectedMonth = $state(currentDate.getMonth()); // 0-11
  let selectedYear = $state(currentDate.getFullYear());
  
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  // Generate year options (current year -1 to +2)
  const years = Array.from({ length: 4 }, (_, i) => currentDate.getFullYear() - 1 + i);
  
  // Manual Add Budget Modal
  let showAddModal = $state(false);
  let newBudget = $state({
    categoryName: '',
    amount: '',
    period: 'monthly'
  });
  let addingBudget = $state(false);
  let addError = $state('');
  
  // Preset categories for dropdown
  const presetCategories = [
    { name: 'Income', icon: 'payments', color: '#10b981' },
    { name: 'Food & Dining', icon: 'restaurant', color: '#f59e0b' },
    { name: 'Transportation', icon: 'directions_car', color: '#3b82f6' },
    { name: 'Utilities', icon: 'bolt', color: '#8b5cf6' },
    { name: 'Housing', icon: 'home', color: '#10b981' },
    { name: 'Entertainment', icon: 'sports_esports', color: '#ec4899' },
    { name: 'Shopping', icon: 'shopping_bag', color: '#6366f1' },
    { name: 'Healthcare', icon: 'medical_services', color: '#ef4444' },
    { name: 'Savings', icon: 'savings', color: '#21c462' },
    { name: 'Motorcycle/Car Loan', icon: 'two_wheeler', color: '#f97316' },
    { name: 'Insurance', icon: 'health_and_safety', color: '#06b6d4' },
    { name: 'Internet & Phone', icon: 'wifi', color: '#8b5cf6' },
    { name: 'Other', icon: 'category', color: '#6b7280' }
  ];
  
  // Fetch user preferences (currency)
  async function fetchPreferences() {
    try {
      const response = await fetch('/api/preferences', {
        credentials: 'include'
      });
      const result = await response.json();
      if (result.preferences?.currency) {
        selectedCurrency = result.preferences.currency;
        console.log('[Budget] Currency loaded:', selectedCurrency);
      }
    } catch (err) {
      console.error('[Budget] Failed to load preferences:', err);
    }
  }
  
  // Fetch budgets on mount and when month changes
  onMount(async () => {
    await fetchPreferences();
    await loadBudgets();
  });
  
  $effect(() => {
    // Re-load when month/year changes
    const _ = selectedMonth + selectedYear;
    loadBudgets();
  });
  
  async function loadBudgets() {
    loading = true;
    error = '';

    try {
      // Fetch budgets
      const response = await fetch(`/api/budgets?month=${selectedMonth + 1}&year=${selectedYear}`, {
        credentials: 'include'
      });

      const data = await response.json();

      // Fetch transactions to calculate spent
      const startDate = new Date(selectedYear, selectedMonth, 1).toISOString().split('T')[0];
      const endDate = new Date(selectedYear, selectedMonth + 1, 0).toISOString().split('T')[0];
      const txResponse = await fetch(`/api/transactions?startDate=${startDate}&endDate=${endDate}`, {
        credentials: 'include'
      });
      const txData = await txResponse.json();

      // Calculate spent/income by category
      const spentByCategory: Record<string, number> = {};
      let incomeTotal = 0;
      let otherSpent = 0;

      if (txData.transactions) {
        for (const tx of txData.transactions) {
          if (tx.type === 'income') {
            incomeTotal += tx.amount;
          } else if (tx.type === 'expense') {
            const catName = tx.categoryName || 'Other';
            if (catName === 'Other') {
              otherSpent += tx.amount;
            } else {
              spentByCategory[catName] = (spentByCategory[catName] || 0) + tx.amount;
            }
          }
        }
      }

      if (data.budgets) {
        budgets = data.budgets.map((b: any) => ({
          ...b,
          spent: spentByCategory[b.categoryName] || 0
        }));

        // Add "Other" category as unlimited (always shown)
        budgets.push({
          id: 'other-unlimited',
          categoryName: 'Other',
          categoryIcon: 'category',
          categoryColor: '#6b7280',
          limitAmount: -1, // -1 = unlimited
          spent: otherSpent
        });

        // Add "Income" category (always shown, increases remaining)
        budgets.push({
          id: 'income-unlimited',
          categoryName: 'Income',
          categoryIcon: 'payments',
          categoryColor: '#10b981',
          limitAmount: -1, // -1 = unlimited (income adds to remaining)
          spent: incomeTotal
        });
      }
    } catch (err: any) {
      console.error('Failed to load budgets:', err);
      error = 'Failed to load budgets';
    } finally {
      loading = false;
    }
  }
  
  async function addBudget() {
    if (!newBudget.categoryName || !newBudget.amount) {
      addError = 'Please fill in all fields';
      return;
    }
    
    addingBudget = true;
    addError = '';
    
    try {
      const response = await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          categoryName: newBudget.categoryName,
          amount: parseFloat(newBudget.amount),
          period: newBudget.period,
          month: selectedMonth + 1,
          year: selectedYear
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        showAddModal = false;
        newBudget = { categoryName: '', amount: '', period: 'monthly' };
        await loadBudgets();
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      addError = err.message || 'Failed to add budget';
    } finally {
      addingBudget = false;
    }
  }
  
  async function deleteBudget(id: string) {
    if (!confirm('Are you sure you want to delete this budget?')) return;
    
    try {
      const response = await fetch(`/api/budgets/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (response.ok) {
        budgets = budgets.filter(b => b.id !== id);
      }
    } catch (err) {
      console.error('Failed to delete budget:', err);
    }
  }
  
  function goToAICoach() {
    goto('/coach');
  }
  
  function openAddModal() {
    showAddModal = true;
    addError = '';
  }
  
  function closeAddModal() {
    showAddModal = false;
    newBudget = { categoryName: '', amount: '', period: 'monthly' };
    addError = '';
  }
  
  function formatAmount(amount: number): string {
    const curr = currencies[selectedCurrency];
    return curr.symbol + ' ' + new Intl.NumberFormat(curr.locale).format(amount);
  }
  
  function getPercentage(spent: number, limit: number): number {
    if (limit === 0) return 0;
    return Math.min((spent / limit) * 100, 100);
  }
  
  function getStatus(spent: number, limit: number): 'safe' | 'warning' | 'danger' {
    if (limit === 0) return 'safe';
    const percentage = (spent / limit) * 100;
    if (percentage >= 100) return 'danger';
    if (percentage >= 80) return 'warning';
    return 'safe';
  }
  
  const totalBudget = $derived(budgets.reduce((sum, b) => b.limitAmount > 0 ? sum + b.limitAmount : sum, 0));
  const totalSpent = $derived(budgets.reduce((sum, b) => b.categoryName === 'Income' ? sum : sum + b.spent, 0));
  const totalIncome = $derived(budgets.find(b => b.categoryName === 'Income')?.spent || 0);
  const remaining = $derived(totalBudget - totalSpent + totalIncome);

  const selectedMonthYear = $derived(`${months[selectedMonth]} ${selectedYear}`);
</script>

<svelte:head>
  <title>Budget - MoneyKracked</title>
</svelte:head>

<!-- Page Header with Month Selector -->
<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
  <div>
    <h2 class="text-3xl font-black tracking-tight text-white">Budget</h2>
    <p class="mt-1 text-base text-text-secondary">Set spending limits and track your progress</p>
  </div>
  
  <!-- Month/Year Selector -->
  <div class="flex items-center gap-2">
    <button
      onclick={() => {
        if (selectedMonth === 0) {
          selectedMonth = 11;
          selectedYear--;
        } else {
          selectedMonth--;
        }
      }}
      class="p-2 rounded-lg bg-surface-dark border border-border-dark text-text-secondary hover:text-white hover:border-primary transition-colors"
    >
      <span class="material-symbols-outlined">chevron_left</span>
    </button>
    
    <div class="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-dark border border-border-dark">
      <span class="material-symbols-outlined text-primary">calendar_month</span>
      <select
        bind:value={selectedMonth}
        class="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
      >
        {#each months as month, i}
          <option value={i} class="bg-surface-dark">{month}</option>
        {/each}
      </select>
      <select
        bind:value={selectedYear}
        class="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
      >
        {#each years as year}
          <option value={year} class="bg-surface-dark">{year}</option>
        {/each}
      </select>
    </div>
    
    <button
      onclick={() => {
        if (selectedMonth === 11) {
          selectedMonth = 0;
          selectedYear++;
        } else {
          selectedMonth++;
        }
      }}
      class="p-2 rounded-lg bg-surface-dark border border-border-dark text-text-secondary hover:text-white hover:border-primary transition-colors"
    >
      <span class="material-symbols-outlined">chevron_right</span>
    </button>
  </div>
</div>

<!-- Budget Overview -->
<div class="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
  <Card>
    <p class="text-sm font-medium text-text-secondary">Total Budget</p>
    <h3 class="mt-2 text-2xl font-bold text-white">
      {totalBudget > 0 ? formatAmount(totalBudget) : '-'}
    </h3>
    <p class="text-xs text-text-muted mt-1">{selectedMonthYear}</p>
  </Card>
  <Card>
    <p class="text-sm font-medium text-text-secondary">Total Spent</p>
    <h3 class="mt-2 text-2xl font-bold text-warning">
      {totalSpent > 0 ? formatAmount(totalSpent) : '-'}
    </h3>
  </Card>
  <Card>
    <p class="text-sm font-medium text-text-secondary">Remaining</p>
    <h3 class="mt-2 text-2xl font-bold {remaining >= 0 ? 'text-primary' : 'text-danger'}">
      {totalBudget > 0 ? formatAmount(Math.abs(remaining)) : '-'}
      {#if remaining < 0 && totalBudget > 0}
        <span class="text-sm font-normal text-danger">(over budget)</span>
      {/if}
    </h3>
  </Card>
</div>

<!-- Category Budgets -->
<Card padding="lg">
  <div class="flex items-center justify-between mb-6">
    <h3 class="text-lg font-bold text-white">Category Budgets</h3>
    <div class="flex gap-2">
      <Button variant="secondary" size="sm" onclick={goToAICoach}>
        {#snippet icon()}
          <span class="material-symbols-outlined text-lg">smart_toy</span>
        {/snippet}
        Ask AI
      </Button>
      <Button size="sm" onclick={openAddModal}>
        {#snippet icon()}
          <span class="material-symbols-outlined text-lg">add</span>
        {/snippet}
        Add Budget
      </Button>
    </div>
  </div>
  
  {#if loading}
    <div class="py-12 text-center">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
      <p class="text-text-muted mt-4">Loading budgets...</p>
    </div>
  {:else if error}
    <div class="py-12 text-center">
      <span class="material-symbols-outlined text-5xl text-danger mb-4">error</span>
      <p class="text-danger">{error}</p>
      <Button variant="secondary" onclick={loadBudgets} class="mt-4">Retry</Button>
    </div>
  {:else if budgets.length > 0}
    <div class="space-y-6">
      {#each budgets as budget}
        {@const isUnlimited = budget.limitAmount === -1}
        {@const isIncome = budget.categoryName === 'Income'}
        {@const percentage = isUnlimited ? 0 : getPercentage(budget.spent, budget.limitAmount)}
        {@const status = isUnlimited ? 'normal' : getStatus(budget.spent, budget.limitAmount)}

        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div
                class="flex h-10 w-10 items-center justify-center rounded-lg"
                style="background-color: {budget.categoryColor}20; color: {budget.categoryColor}"
              >
                <span class="material-symbols-outlined">{budget.categoryIcon}</span>
              </div>
              <div>
                <p class="font-medium text-white">{budget.categoryName}</p>
                {#if isIncome}
                  <p class="text-xs text-green-400">
                    +{formatAmount(budget.spent)} received
                  </p>
                {:else if isUnlimited}
                  <p class="text-xs text-text-muted">
                    {formatAmount(budget.spent)} spent
                  </p>
                {:else}
                  <p class="text-xs text-text-muted">
                    {formatAmount(budget.spent)} / {formatAmount(budget.limitAmount)}
                  </p>
                {/if}
              </div>
            </div>
            <div class="flex items-center gap-3">
              <div class="text-right">
                {#if isIncome}
                  <p class="font-bold text-green-400">Income</p>
                  <p class="text-xs text-text-muted">Adds to remaining</p>
                {:else if isUnlimited}
                  <p class="font-bold text-blue-400">Unlimited</p>
                  <p class="text-xs text-text-muted">No limit</p>
                {:else}
                  <p class="font-bold {status === 'danger' ? 'text-danger' : status === 'warning' ? 'text-warning' : 'text-white'}">
                    {percentage.toFixed(0)}%
                  </p>
                  {#if budget.spent > budget.limitAmount}
                    <p class="text-xs text-danger">+{formatAmount(budget.spent - budget.limitAmount)} over</p>
                  {:else}
                    <p class="text-xs text-text-muted">{formatAmount(budget.limitAmount - budget.spent)} left</p>
                  {/if}
                {/if}
              </div>
              {#if !isUnlimited && !isIncome}
                <button
                  onclick={() => deleteBudget(budget.id)}
                  class="p-1 text-text-muted hover:text-danger transition-colors"
                  title="Delete budget"
                >
                  <span class="material-symbols-outlined text-lg">delete</span>
                </button>
              {/if}
            </div>
          </div>

          <!-- Progress Bar (not for unlimited or income) -->
          {#if !isUnlimited && !isIncome}
            <div class="h-2 rounded-full bg-border-dark overflow-hidden">
              <div 
                class="h-full rounded-full transition-all duration-500"
                style="width: {percentage}%; background-color: {status === 'danger' ? '#ef4444' : status === 'warning' ? '#f59e0b' : budget.categoryColor}"
              ></div>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {:else}
    <div class="py-12 text-center">
      <span class="material-symbols-outlined text-5xl text-text-muted mb-4">savings</span>
      <h3 class="text-lg font-semibold text-white mb-2">No budgets for {selectedMonthYear}</h3>
      <p class="text-text-muted mb-6 max-w-sm mx-auto">
        Create a budget manually or let AI help you plan
      </p>
      <div class="flex justify-center gap-3">
        <Button variant="secondary" onclick={goToAICoach}>
          {#snippet icon()}
            <span class="material-symbols-outlined">smart_toy</span>
          {/snippet}
          Setup with AI
        </Button>
        <Button onclick={openAddModal}>
          {#snippet icon()}
            <span class="material-symbols-outlined">add</span>
          {/snippet}
          Add Manually
        </Button>
      </div>
    </div>
  {/if}
</Card>

<!-- Add Budget Modal -->
{#if showAddModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
    <div class="bg-surface-dark rounded-2xl border border-border-dark w-full max-w-md mx-4 shadow-2xl">
      <div class="p-6 border-b border-border-dark">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-bold text-white">Add Budget</h3>
          <button onclick={closeAddModal} class="text-text-muted hover:text-white">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
        <p class="text-sm text-text-muted mt-1">For {selectedMonthYear}</p>
      </div>
      
      <div class="p-6 space-y-4">
        {#if addError}
          <div class="p-3 bg-danger/10 border border-danger/30 rounded-lg text-danger text-sm">
            {addError}
          </div>
        {/if}
        
        <!-- Category Select -->
        <div>
          <label for="budget-category" class="block text-sm font-medium text-text-secondary mb-1.5">Category</label>
          <select
            id="budget-category"
            bind:value={newBudget.categoryName}
            class="w-full px-4 py-2.5 rounded-lg bg-bg-dark border border-border-dark text-white focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Select category...</option>
            {#each presetCategories.filter(c => c.name !== 'Income' && c.name !== 'Other') as cat}
              <option value={cat.name}>{cat.name}</option>
            {/each}
          </select>
          <p class="text-xs text-text-muted mt-1">
            Income & Other are added automatically
          </p>
        </div>
        
        <!-- Amount -->
        <div>
          <label for="budget-amount" class="block text-sm font-medium text-text-secondary mb-1.5">
            Budget Amount ({currencies[selectedCurrency].symbol})
          </label>
          <input
            id="budget-amount"
            type="number"
            placeholder="e.g. 500"
            bind:value={newBudget.amount}
            class="w-full px-4 py-2.5 rounded-lg bg-bg-dark border border-border-dark text-white placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>
      
      <div class="p-6 border-t border-border-dark flex justify-end gap-3">
        <Button variant="secondary" onclick={closeAddModal} disabled={addingBudget}>
          Cancel
        </Button>
        <Button onclick={addBudget} loading={addingBudget}>
          Add Budget
        </Button>
      </div>
    </div>
  </div>
{/if}
