<script lang="ts">
  import { IsometricCard, PixelButton } from '$lib/components/ui';
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { type Currency } from '$lib/utils/currency';
  import { getExchangeRates, getUserPreferences, getCachedRatesSync, getCachedPreferencesSync, toggleSidebar } from '$lib/stores/app-store.svelte';
  import { subscribeToCurrency, convertAmountMYR, convertToMYR } from '$lib/stores/currency-store';

  // Currency settings
  const currencies: Record<string, { symbol: string; name: string; locale: string }> = {
    'MYR': { symbol: 'RM', name: 'Malaysian Ringgit', locale: 'en-MY' },
    'SGD': { symbol: 'S$', name: 'Singapore Dollar', locale: 'en-SG' },
    'USD': { symbol: '$', name: 'US Dollar', locale: 'en-US' }
  };

  const formatters = {
    'en-MY': new Intl.NumberFormat('en-MY'),
    'en-SG': new Intl.NumberFormat('en-SG'),
    'en-US': new Intl.NumberFormat('en-US')
  };

  function formatNumber(amount: number, locale: string): string {
    return formatters[locale as keyof typeof formatters]?.format(amount) || amount.toLocaleString();
  }

  // ============================================================
  // REACTIVE CURRENCY STATE - automatically updates UI on change
  // ============================================================
  let selectedCurrency = $state<Currency>((getCachedPreferencesSync()?.currency as Currency) || 'MYR');
  let exchangeRates = $state<Record<string, Record<string, number>>>(getCachedRatesSync() || {});
  
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
  
  const currentDate = new Date();
  let selectedMonth = $state(currentDate.getMonth());
  let selectedYear = $state(currentDate.getFullYear());
  
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  const years = Array.from({ length: 4 }, (_, i) => currentDate.getFullYear() - 1 + i);
  
  let showAddModal = $state(false);
  let newBudget = $state({ categoryName: '', amount: '', period: 'monthly' });
  let addingBudget = $state(false);
  let addError = $state('');

  let showEditModal = $state(false);
  let showEditConfirmModal = $state(false);
  let currentEditingBudget = $state<Budget | null>(null);
  let editBudget = $state({ categoryName: '', amount: '', period: 'monthly' });
  let savingEdit = $state(false);
  let editError = $state('');

  let showDeleteConfirmModal = $state(false);
  let deletingBudgetId = $state<string | null>(null);
  let deletingBudget = $state(false);
  
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
  
  let unsubscribeCurrency: (() => void) | undefined;

  onMount(async () => {
    const [rates, prefs] = await Promise.all([
      getExchangeRates(),
      getUserPreferences()
    ]);

    if (rates) exchangeRates = rates;
    if (prefs?.currency) selectedCurrency = prefs.currency;

    await loadBudgets();

    unsubscribeCurrency = subscribeToCurrency((currency: Currency, rates: Record<string, Record<string, number>>) => {
      selectedCurrency = currency;
      exchangeRates = rates;
    });
  });

  onDestroy(() => {
    unsubscribeCurrency?.();
  });

  function convertAmount(amountMYR: number): number {
    return convertAmountMYR(amountMYR, selectedCurrency, exchangeRates);
  }

  function convertToMYRValue(amount: number): number {
    return convertToMYR(amount, selectedCurrency, exchangeRates);
  }
  
  $effect(() => {
    const _ = selectedMonth + selectedYear;
    loadBudgets();
  });

  async function loadBudgets() {
    loading = true;
    error = '';

    try {
      const response = await fetch(`/api/budgets?month=${selectedMonth + 1}&year=${selectedYear}`, {
        credentials: 'include'
      });

      const data = await response.json();

      const startDate = new Date(selectedYear, selectedMonth, 1).toISOString().split('T')[0];
      const endDate = new Date(selectedYear, selectedMonth + 1, 0).toISOString().split('T')[0];
      const txResponse = await fetch(`/api/transactions?startDate=${startDate}&endDate=${endDate}`, {
        credentials: 'include'
      });
      const txData = await txResponse.json();

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
          limitAmount: b.limitAmount,
          spent: spentByCategory[b.categoryName] || 0
        }));

        budgets.push({
          id: 'other-unlimited',
          categoryName: 'Other',
          categoryIcon: 'category',
          categoryColor: '#6b7280',
          limitAmount: -1,
          spent: otherSpent
        });

        budgets.push({
          id: 'income-unlimited',
          categoryName: 'Income',
          categoryIcon: 'payments',
          categoryColor: '#10b981',
          limitAmount: -1,
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
          amount: convertToMYRValue(parseFloat(newBudget.amount)),
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
    deletingBudgetId = id;
    showDeleteConfirmModal = true;
  }

  async function confirmDelete() {
    if (!deletingBudgetId) return;
    deletingBudget = true;
    try {
      const response = await fetch(`/api/budgets/${deletingBudgetId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (response.ok) {
        budgets = budgets.filter(b => b.id !== deletingBudgetId);
        showDeleteConfirmModal = false;
        deletingBudgetId = null;
      } else {
        editError = 'Failed to delete budget';
      }
    } catch (err) {
      console.error('Failed to delete budget:', err);
      editError = 'Failed to delete budget';
    } finally {
      deletingBudget = false;
    }
  }

  function cancelDelete() {
    showDeleteConfirmModal = false;
    deletingBudgetId = null;
    editError = '';
  }

  function openEditModal(budget: Budget) {
    currentEditingBudget = budget;
    editBudget = {
      categoryName: budget.categoryName,
      amount: String(budget.limitAmount),
      period: budget.period || 'monthly'
    };
    editError = '';
    showEditModal = true;
  }

  function closeEditModal() {
    showEditModal = false;
    currentEditingBudget = null;
    editError = '';
  }

  function initiateSaveEdit() {
    if (!editBudget.categoryName || !editBudget.amount) {
      editError = 'Please fill in all fields';
      return;
    }
    showEditConfirmModal = true;
  }

  async function confirmSaveEdit() {
    if (!currentEditingBudget) return;
    savingEdit = true;
    editError = '';
    try {
      const response = await fetch(`/api/budgets/${currentEditingBudget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          amount: convertToMYRValue(parseFloat(editBudget.amount)),
          period: editBudget.period
        })
      });
      const data = await response.json();
      if (data.success) {
        showEditConfirmModal = false;
        showEditModal = false;
        await loadBudgets();
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      editError = err.message || 'Failed to update budget';
    } finally {
      savingEdit = false;
    }
  }

  function cancelEditSave() { showEditConfirmModal = false; }
  function goToAICoach() { goto('/coach'); }
  function openAddModal() { showAddModal = true; addError = ''; }
  function closeAddModal() { showAddModal = false; newBudget = { categoryName: '', amount: '', period: 'monthly' }; addError = ''; }
  
  function formatAmount(amountMYR: number): string {
    const convertedAmount = convertAmountMYR(amountMYR, selectedCurrency, exchangeRates);
    const curr = currencies[selectedCurrency];
    return curr.symbol + ' ' + formatNumber(convertedAmount, curr.locale);
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
  const totalIncome = $derived(budgets.find(b => b.categoryName === 'Income')?.spent || 0);
  const totalBudgetWithIncome = $derived(totalBudget + totalIncome);
  const totalSpent = $derived(budgets.reduce((sum, b) => b.categoryName === 'Income' ? sum : sum + b.spent, 0));
  const remaining = $derived(totalBudgetWithIncome - totalSpent);
  const selectedMonthYear = $derived(`${months[selectedMonth]} ${selectedYear}`);
</script>

<svelte:head>
  <title>Budget - MoneyKracked</title>
</svelte:head>

<div class="flex h-[calc(100%+2rem)] lg:h-[calc(100%+4rem)] w-[calc(100%+4rem)] overflow-hidden bg-[var(--color-bg)] -m-4 lg:-m-8 border-black">
  <!-- Main Budget Column -->
  <div class="flex-1 flex flex-col min-w-0 h-full relative bg-[var(--color-bg)]">
    <!-- App-like Inline Header -->
    <header class="h-20 flex items-center justify-between px-6 lg:px-10 border-b-4 border-black bg-[var(--color-surface-raised)] flex-shrink-0 z-20 shadow-lg">
      <div class="flex items-center gap-4">
        <button class="lg:hidden mr-2 p-2 -ml-2 text-[var(--color-text)] hover:bg-[var(--color-surface)] rounded-none transition-colors" onclick={toggleSidebar}>
          <span class="material-symbols-outlined">menu</span>
        </button>
        <div>
          <h2 class="text-lg md:text-xl font-display text-[var(--color-primary)]">BUDGET <span class="text-[var(--color-text)]">PLANNER</span></h2>
          <p class="text-[9px] md:text-[10px] font-mono text-[var(--color-text-muted)] flex items-center gap-2 uppercase">
            <span class="flex h-2 w-2 rounded-full bg-[var(--color-primary)] animate-pulse"></span>
            Limits for {selectedMonthYear}
          </p>
        </div>
      </div>
      
      <div class="flex items-center gap-4">
        <!-- Month/Year Selector -->
        <div class="hidden sm:flex items-center gap-2">
          <button onclick={() => { if (selectedMonth===0) {selectedMonth=11;selectedYear--;} else selectedMonth--; }}
            class="h-10 w-10 border-2 border-black bg-[var(--color-surface)] flex items-center justify-center hover:bg-[var(--color-surface-raised)] transition-colors"
          >
            <span class="material-symbols-outlined">chevron_left</span>
          </button>
          
          <div class="flex h-10 items-center gap-2 px-3 border-2 border-black bg-[var(--color-surface)]">
            <select bind:value={selectedMonth} class="bg-transparent text-[var(--color-text)] font-mono text-[10px] uppercase font-bold focus:outline-none cursor-pointer">
              {#each months as month, i} <option value={i} class="bg-[var(--color-surface)] font-mono">{month}</option> {/each}
            </select>
            <div class="w-px h-4 bg-black/20"></div>
            <select bind:value={selectedYear} class="bg-transparent text-[var(--color-text)] font-mono text-[10px] uppercase font-bold focus:outline-none cursor-pointer">
              {#each years as year} <option value={year} class="bg-[var(--color-surface)] font-mono">{year}</option> {/each}
            </select>
          </div>
          
          <button onclick={() => { if (selectedMonth===11) {selectedMonth=0;selectedYear++;} else selectedMonth++; }}
            class="h-10 w-10 border-2 border-black bg-[var(--color-surface)] flex items-center justify-center hover:bg-[var(--color-surface-raised)] transition-colors"
          >
            <span class="material-symbols-outlined">chevron_right</span>
          </button>
        </div>
      </div>
    </header>

    <!-- Scrollable Content Area -->
    <div class="flex-1 overflow-y-auto p-6 lg:p-10 space-y-8 scroll-smooth custom-scrollbar">

<!-- Budget Overview -->
<div class="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
  <IsometricCard class="bg-[var(--color-surface)]">
    <p class="text-xs font-mono text-[var(--color-text-muted)] uppercase tracking-widest">Total Budget</p>
    <h3 class="mt-2 text-2xl font-bold font-mono text-[var(--color-text)]">
      {totalBudgetWithIncome > 0 ? formatAmount(totalBudgetWithIncome) : '-'}
    </h3>
  </IsometricCard>
  <IsometricCard>
    <p class="text-xs font-mono text-[var(--color-text-muted)] uppercase tracking-widest">Total Spent</p>
    <h3 class="mt-2 text-2xl font-bold font-mono text-[var(--color-warning)]">
      {totalSpent > 0 ? formatAmount(totalSpent) : '-'}
    </h3>
  </IsometricCard>
  <IsometricCard>
    <p class="text-xs font-mono text-[var(--color-text-muted)] uppercase tracking-widest">Remaining</p>
    <h3 class="mt-2 text-2xl font-bold font-mono {remaining >= 0 ? 'text-[var(--color-primary)]' : 'text-[var(--color-danger)]'}">
      {totalBudgetWithIncome > 0 ? formatAmount(Math.abs(remaining)) : '-'}
    </h3>
    {#if remaining < 0 && totalBudgetWithIncome > 0}
         <span class="text-xs text-[var(--color-danger)] uppercase font-bold">[OVER BUDGET]</span>
    {/if}
  </IsometricCard>
</div>

<!-- Category Budgets -->
<IsometricCard title="Budget Details">
  <div class="flex items-center justify-between mb-6">
    <h3 class="text-sm font-bold font-display uppercase text-[var(--color-text)] hidden sm:block">Categories</h3>
    <div class="flex items-center gap-3">
      <PixelButton variant="secondary" onclick={goToAICoach} class="flex-1 sm:flex-none py-3 px-3">
         <span class="material-symbols-outlined text-sm">smart_toy</span>
         <span class="text-[10px] sm:text-xs">AI SETUP</span>
      </PixelButton>
      <PixelButton variant="primary" onclick={openAddModal} class="flex-1 sm:flex-none py-3 px-3">
         <span class="material-symbols-outlined text-sm">add</span>
         <span class="text-[10px] sm:text-xs">ADD BUDGET</span>
      </PixelButton>
    </div>
  </div>
  
  {#if loading}
    <div class="py-12 text-center col-span-full">
      <div class="inline-block animate-spin h-8 w-8 border-4 border-[var(--color-primary)] border-t-transparent mb-4"></div>
      <p class="text-[var(--color-text-muted)] font-mono">Loading Budgets...</p>
    </div>
  {:else if error}
    <div class="py-12 text-center">
      <span class="material-symbols-outlined text-5xl text-[var(--color-danger)] mb-4">error</span>
      <p class="text-[var(--color-danger)] font-mono">{error}</p>
      <PixelButton onclick={loadBudgets} class="mt-4">Retry</PixelButton>
    </div>
  {:else if budgets.length > 0}
    <div class="space-y-4">
      {#each budgets as budget}
        {@const isUnlimited = budget.limitAmount === -1}
        {@const isIncome = budget.categoryName === 'Income'}
        {@const percentage = isUnlimited ? 0 : getPercentage(budget.spent, budget.limitAmount)}
        {@const status = isUnlimited ? 'normal' : getStatus(budget.spent, budget.limitAmount)}

        <div class="p-4 border-2 border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm hover:translate-x-1 transition-transform">
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-3">
              <div
                class="flex h-10 w-10 items-center justify-center border-2 border-[var(--color-border)] shadow-[2px_2px_0px_0px_var(--color-shadow)]"
                style="background-color: {budget.categoryColor}20; color: {budget.categoryColor}"
              >
                <span class="material-symbols-outlined">{budget.categoryIcon}</span>
              </div>
              <div>
                <p class="font-bold text-[var(--color-text)] font-ui">{budget.categoryName}</p>
                {#if isIncome}
                  <p class="text-xs text-[var(--color-success)] font-mono">+{formatAmount(budget.spent)}</p>
                {:else if isUnlimited}
                  <p class="text-xs text-[var(--color-text-muted)] font-mono">{formatAmount(budget.spent)} spent</p>
                {:else}
                  <p class="text-xs text-[var(--color-text-muted)] font-mono">
                    Spent: {formatAmount(budget.spent)} <span class="text-[var(--color-text)]">/</span> Limit: {formatAmount(budget.limitAmount)}
                  </p>
                {/if}
              </div>
            </div>
             <div class="flex items-center gap-3">
               <div class="text-right">
                {#if isIncome}
                  <p class="font-bold text-[var(--color-success)] font-mono">Income</p>
                {:else if isUnlimited}
                  <p class="font-bold text-[var(--color-info)] font-mono">Unlimited</p>
                {:else}
                  <p class="font-bold font-mono {status === 'danger' ? 'text-[var(--color-danger)]' : status === 'warning' ? 'text-[var(--color-warning)]' : 'text-[var(--color-text)]'}">
                    {percentage.toFixed(0)}%
                  </p>
                  {#if budget.spent > budget.limitAmount}
                    <p class="text-xs text-[var(--color-danger)] font-mono">+{formatAmount(budget.spent - budget.limitAmount)} over</p>
                  {:else}
                    <p class="text-xs text-[var(--color-text-muted)] font-mono">{formatAmount(budget.limitAmount - budget.spent)} left</p>
                  {/if}
                {/if}
              </div>
              
              {#if !isUnlimited && !isIncome}
                <div class="flex items-center gap-1 opacity-50 hover:opacity-100 transition-opacity">
                    <button onclick={() => openEditModal(budget)} class="p-1 hover:text-[var(--color-primary)]"><span class="material-symbols-outlined text-lg">edit</span></button>
                    <button onclick={() => deleteBudget(budget.id)} class="p-1 hover:text-[var(--color-danger)]"><span class="material-symbols-outlined text-lg">delete</span></button>
                </div>
              {/if}
             </div>
          </div>
          
           <!-- Progress Bar -->
           {#if !isUnlimited && !isIncome}
            <div class="h-4 bg-[var(--color-bg)] border-2 border-[var(--color-border)] relative mt-2">
              <div 
                class="h-full absolute top-0 left-0 transition-all duration-500"
                style="width: {percentage}%; background-color: {status === 'danger' ? 'var(--color-danger)' : status === 'warning' ? 'var(--color-warning)' : 'var(--color-success)'}"
              ></div>
              <!-- Grid lines on progress bar -->
              <div class="absolute inset-0 bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAIklEQVQIW2NkQAKrVq36zwjjgzhhYWGMYAEYB8RmROaABADeOQ8CXl/xfgAAAABJRU5ErkJggg==')] opacity-20"></div>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {:else}
    <div class="p-12 text-center">
      <span class="material-symbols-outlined text-5xl text-[var(--color-text-muted)] mb-4">savings</span>
      <h3 class="text-lg font-bold text-[var(--color-text)] mb-2 font-display uppercase">No Budgets</h3>
      <p class="text-[var(--color-text-muted)] mb-6 font-mono text-sm">Create a budget manually or let AI help you plan.</p>
    </div>
  {/if}
</IsometricCard>

<!-- Add Budget Modal -->
{#if showAddModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
    <div class="bg-[var(--color-surface)] border-4 border-[var(--color-border)] shadow-[var(--shadow-primary)] w-full max-w-md">
      <div class="flex items-center justify-between p-4 border-b-4 border-[var(--color-border)] bg-[var(--color-surface-raised)]">
          <h3 class="text-lg font-bold text-[var(--color-text)] font-display uppercase">New Budget</h3>
          <button onclick={closeAddModal} class="text-[var(--color-text-muted)] hover:text-[var(--color-danger)]">
            <span class="material-symbols-outlined font-bold">close</span>
          </button>
      </div>
      <div class="p-6 space-y-4">
         {#if addError} <p class="text-[var(--color-danger)] font-mono text-xs border border-[var(--color-danger)] p-2">{addError}</p> {/if}
         
         <div>
            <label for="b-cat" class="block text-xs font-bold text-[var(--color-text-muted)] font-mono mb-1 uppercase">Category</label>
            <div class="relative">
                <select id="b-cat" bind:value={newBudget.categoryName} class="iso-input appearance-none">
                    <option value="">Select...</option>
                    {#each presetCategories.filter(c => c.name !== 'Income' && c.name !== 'Other') as cat}
                        <option value={cat.name}>{cat.name}</option>
                    {/each}
                </select>
                <span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-text-muted)]">expand_more</span>
            </div>
         </div>
         
         <div>
            <label for="b-amount" class="block text-xs font-bold text-[var(--color-text-muted)] font-mono mb-1 uppercase">Limit ({currencies[selectedCurrency].symbol})</label>
            <input id="b-amount" type="number" bind:value={newBudget.amount} class="iso-input text-xl font-bold font-mono" placeholder="0" />
         </div>
      </div>
      <div class="p-4 border-t-4 border-[var(--color-border)] bg-[var(--color-surface-raised)] flex justify-end gap-3">
          <PixelButton variant="ghost" onclick={closeAddModal} disabled={addingBudget}>Cancel</PixelButton>
          <PixelButton variant="primary" onclick={addBudget} loading={addingBudget}>Confirm</PixelButton>
      </div>
    </div>
  </div>
{/if}

<!-- Helper Modals (Delete/Edit) -->
{#if showDeleteConfirmModal}
    <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <div class="bg-[var(--color-surface)] border-4 border-[var(--color-border)] shadow-[var(--shadow-primary)] p-6 max-w-sm text-center">
            <span class="material-symbols-outlined text-5xl text-[var(--color-danger)] mb-4">delete_forever</span>
            <h3 class="text-xl font-bold text-[var(--color-text)] font-display uppercase mb-2">Delete Budget?</h3>
             <div class="flex justify-center gap-4 mt-6">
                <PixelButton variant="ghost" onclick={cancelDelete} disabled={deletingBudget}>Cancel</PixelButton>
                <PixelButton variant="danger" onclick={confirmDelete} loading={deletingBudget}>Delete</PixelButton>
            </div>
        </div>
    </div>
{/if}
    </div>
  </div>

{#if showEditModal && currentEditingBudget}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
    <div class="bg-[var(--color-surface)] border-4 border-[var(--color-border)] shadow-[var(--shadow-primary)] w-full max-w-md">
      <div class="p-4 border-b-4 border-[var(--color-border)] bg-[var(--color-surface-raised)] flex justify-between">
          <h3 class="text-lg font-bold text-[var(--color-text)] font-display uppercase">Edit Budget</h3>
          <button onclick={closeEditModal}><span class="material-symbols-outlined">close</span></button>
      </div>
      <div class="p-6 space-y-4">
         {#if editError} <p class="text-[var(--color-danger)] font-mono text-xs">{editError}</p> {/if}
         <div class="p-2 bg-[var(--color-bg)] border-2 border-[var(--color-border)]">
            <span class="block text-xs font-mono text-[var(--color-text-muted)] uppercase">Category</span>
            <span class="font-bold text-[var(--color-text)] font-display">{editBudget.categoryName}</span>
         </div>
         <div>
            <label for="eb-amount" class="block text-xs font-bold text-[var(--color-text-muted)] font-mono mb-1 uppercase">Limit ({currencies[selectedCurrency].symbol})</label>
            <input id="eb-amount" type="number" bind:value={editBudget.amount} class="iso-input text-xl font-bold font-mono" />
         </div>
      </div>
      <div class="p-4 border-t-4 border-[var(--color-border)] bg-[var(--color-surface-raised)] flex justify-end gap-3">
          <PixelButton variant="ghost" onclick={closeEditModal} disabled={savingEdit}>Cancel</PixelButton>
          <PixelButton variant="primary" onclick={initiateSaveEdit}>Save</PixelButton>
      </div>
    </div>
  </div>
{/if}

{#if showEditConfirmModal}
     <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <div class="bg-[var(--color-surface)] border-4 border-[var(--color-border)] shadow-[var(--shadow-primary)] p-6 max-w-sm text-center">
            <span class="material-symbols-outlined text-5xl text-[var(--color-primary)] mb-4">save</span>
            <h3 class="text-xl font-bold text-[var(--color-text)] font-display uppercase mb-2">Save Changes?</h3>
            <div class="flex justify-center gap-4 mt-4">
                <PixelButton variant="ghost" onclick={cancelEditSave} disabled={savingEdit}>Back</PixelButton>
                <PixelButton variant="primary" onclick={confirmSaveEdit} loading={savingEdit}>Confirm</PixelButton>
            </div>
        </div>
    </div>
{/if}
</div>

<style>
    .custom-scrollbar::-webkit-scrollbar {
        width: 12px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
        background: var(--color-bg);
        border-left: 2px solid rgba(0,0,0,0.1);
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
        background: var(--color-surface-raised);
        border: 2px solid var(--color-border);
    }
</style>