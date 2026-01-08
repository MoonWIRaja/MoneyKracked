<script lang="ts">
  import { Header } from '$lib/components/layout';
  import { Card, Button } from '$lib/components/ui';
  import { onMount } from 'svelte';
  
  // Currency settings
  const currencies: Record<string, { symbol: string; locale: string }> = {
    'MYR': { symbol: 'RM', locale: 'en-MY' },
    'SGD': { symbol: 'S$', locale: 'en-SG' },
    'USD': { symbol: '$', locale: 'en-US' }
  };
  
  let selectedCurrency = $state('MYR');
  
  // Month/Year selector
  const currentDate = new Date();
  let selectedMonth = $state(currentDate.getMonth()); // 0-11
  let selectedYear = $state(currentDate.getFullYear());
  
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  const years = Array.from({ length: 4 }, (_, i) => currentDate.getFullYear() - 2 + i);
  
  // "Other" category is always available (default, unlimited)
  const otherCategory = { id: 'other', name: 'Other', icon: 'category', color: '#6b7280' };
  
  // Date restrictions: only current month, only today or earlier
  const todayStr = currentDate.toISOString().split('T')[0];
  const monthStartStr = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString().split('T')[0];
  
  // Check if selected month allows adding transactions
  const isCurrentMonth = $derived(
    selectedMonth === currentDate.getMonth() && selectedYear === currentDate.getFullYear()
  );
  
  const isFutureMonth = $derived(
    selectedYear > currentDate.getFullYear() || 
    (selectedYear === currentDate.getFullYear() && selectedMonth > currentDate.getMonth())
  );
  
  const isPastMonth = $derived(
    selectedYear < currentDate.getFullYear() || 
    (selectedYear === currentDate.getFullYear() && selectedMonth < currentDate.getMonth())
  );
  
  const canAddTransaction = $derived(isCurrentMonth);
  
  interface Transaction {
    id: string;
    payee: string;
    amount: number;
    type: 'income' | 'expense' | 'transfer';
    date: string;
    categoryId: string | null;
    categoryName: string;
    categoryIcon: string;
    categoryColor: string;
  }
  
  interface BudgetCategory {
    id: string;
    name: string;
    icon: string;
    color: string;
  }
  
  let transactions = $state<Transaction[]>([]);
  let budgetCategories = $state<BudgetCategory[]>([]); // Categories from user's budget
  let loading = $state(true);
  
  // Available categories = categories from budget + Other
  const availableCategories = $derived([...budgetCategories, otherCategory]);
  
  // Filters
  let searchQuery = $state('');
  let selectedCategory = $state('All');
  
  // Add Transaction Modal
  let showAddModal = $state(false);
  let addingTransaction = $state(false);
  let addError = $state('');
  let newTransaction = $state({
    payee: '',
    amount: '',
    type: 'expense' as 'income' | 'expense',
    categoryId: '',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });
  
  // Check if selected category is "Other" (preset id = 'other')
  const isOtherCategory = $derived(newTransaction.categoryId === 'other');
  
  const selectedMonthYear = $derived(`${months[selectedMonth]} ${selectedYear}`);
  
  // Category filter options
  const categoryFilters = $derived(['All', ...new Set(transactions.map(t => t.categoryName))]);
  
  onMount(async () => {
    await fetchPreferences();
    await fetchBudgetCategories();
    await fetchTransactions();
  });
  
  // Re-fetch when month/year changes
  $effect(() => {
    const _ = selectedMonth + selectedYear;
    fetchTransactions();
  });
  
  async function fetchPreferences() {
    try {
      const response = await fetch('/api/preferences', { credentials: 'include' });
      const result = await response.json();
      if (result.preferences?.currency) {
        selectedCurrency = result.preferences.currency;
      }
    } catch (err) {
      console.error('Failed to load preferences:', err);
    }
  }
  
  async function fetchBudgetCategories() {
    try {
      // Fetch budgets for current month to get available categories
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();
      
      const response = await fetch(`/api/budgets?month=${month}&year=${year}`, { credentials: 'include' });
      const result = await response.json();
      if (result.budgets) {
        // Extract categories from budgets
        budgetCategories = result.budgets.map((b: any) => ({
          id: b.categoryName.toLowerCase().replace(/\s+/g, '-'),
          name: b.categoryName,
          icon: b.categoryIcon || 'category',
          color: b.categoryColor || '#6b7280'
        }));
      }
    } catch (err) {
      console.error('Failed to load budget categories:', err);
    }
  }
  
  async function fetchTransactions() {
    loading = true;
    try {
      // Calculate date range for selected month
      const startDate = new Date(selectedYear, selectedMonth, 1).toISOString().split('T')[0];
      const endDate = new Date(selectedYear, selectedMonth + 1, 0).toISOString().split('T')[0];
      
      const response = await fetch(`/api/transactions?startDate=${startDate}&endDate=${endDate}`, { 
        credentials: 'include' 
      });
      const result = await response.json();
      if (result.transactions) {
        transactions = result.transactions;
      }
    } catch (err) {
      console.error('Failed to load transactions:', err);
    } finally {
      loading = false;
    }
  }
  
  async function addTransaction() {
    if (!newTransaction.amount || !newTransaction.type) {
      addError = 'Amount and type are required';
      return;
    }

    // Require notes for "Other" category
    if (isOtherCategory && !newTransaction.notes.trim()) {
      addError = 'Please add a note to describe what this transaction is for';
      return;
    }

    addingTransaction = true;
    addError = '';

    try {
      // Determine category name based on transaction type
      let categoryNameToSend: string | undefined;
      let categoryIdToSend: string | null = null;

      if (newTransaction.type === 'income') {
        // Income transactions always use 'Income' category
        categoryNameToSend = 'Income';
      } else if (newTransaction.type === 'expense') {
        // For expenses: if 'Other' category selected or no category selected
        if (isOtherCategory || !newTransaction.categoryId) {
          categoryNameToSend = 'Other';
        } else {
          // Get category name from the selected category
          const selectedCat = availableCategories.find(c => c.id === newTransaction.categoryId);
          categoryNameToSend = selectedCat?.name;
        }
      }

      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          payee: newTransaction.payee.trim() || (isOtherCategory ? newTransaction.notes : ''),
          amount: parseFloat(newTransaction.amount),
          type: newTransaction.type,
          categoryId: categoryIdToSend,
          categoryName: categoryNameToSend,
          date: newTransaction.date,
          notes: newTransaction.notes
        })
      });

      const result = await response.json();

      if (result.success) {
        showAddModal = false;
        resetNewTransaction();
        await fetchTransactions();
      } else {
        throw new Error(result.error);
      }
    } catch (err: any) {
      addError = err.message || 'Failed to add transaction';
    } finally {
      addingTransaction = false;
    }
  }
  
  async function deleteTransaction(id: string) {
    if (!confirm('Delete this transaction?')) return;
    
    try {
      const response = await fetch(`/api/transactions/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (response.ok) {
        transactions = transactions.filter(t => t.id !== id);
      }
    } catch (err) {
      console.error('Failed to delete transaction:', err);
    }
  }
  
  function resetNewTransaction() {
    newTransaction = {
      payee: '',
      amount: '',
      type: 'expense',
      categoryId: '',
      date: new Date().toISOString().split('T')[0],
      notes: ''
    };
    addError = '';
  }
  
  function openAddModal() {
    if (!canAddTransaction) return;
    showAddModal = true;
    addError = '';
  }
  
  function closeAddModal() {
    showAddModal = false;
    resetNewTransaction();
  }
  
  function formatAmount(amount: number, type: string): string {
    const curr = currencies[selectedCurrency];
    const formatted = curr.symbol + ' ' + new Intl.NumberFormat(curr.locale).format(Math.abs(amount));
    return type === 'income' ? `+ ${formatted}` : `- ${formatted}`;
  }
  
  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric'
    });
  }
  
  const filteredTransactions = $derived(
    transactions.filter(t => {
      const matchesSearch = t.payee.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || t.categoryName === selectedCategory;
      return matchesSearch && matchesCategory;
    })
  );
</script>

<svelte:head>
  <title>Transactions - MoneyKracked</title>
</svelte:head>

<!-- Page Header with Month Selector -->
<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
  <div>
    <h2 class="text-3xl font-black tracking-tight text-white">Transactions</h2>
    <p class="mt-1 text-base text-text-secondary">View and manage your transactions</p>
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
    
    <!-- Add Transaction Button -->
    {#if canAddTransaction}
      <button
        onclick={openAddModal}
        class="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary-hover transition-colors"
      >
        <span class="material-symbols-outlined text-lg">add</span>
        Add Transaction
      </button>
    {/if}
  </div>
</div>

<!-- Status Messages -->
{#if isFutureMonth}
  <div class="mb-4 p-3 bg-warning/10 border border-warning/30 rounded-lg text-warning text-sm flex items-center gap-2">
    <span class="material-symbols-outlined">schedule</span>
    Cannot add transactions for future months
  </div>
{:else if isPastMonth}
  <div class="mb-4 p-3 bg-border-dark border border-border-dark rounded-lg text-text-muted text-sm flex items-center gap-2">
    <span class="material-symbols-outlined">history</span>
    Viewing past transactions (read-only)
  </div>
{/if}

<!-- Filters -->
<Card padding="md">
  <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
    <!-- Search -->
    <div class="relative flex-1 max-w-md">
      <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">search</span>
      <input
        type="text"
        placeholder="Search transactions..."
        bind:value={searchQuery}
        class="w-full pl-10 pr-4 py-2 rounded-lg bg-bg-dark border border-border-dark text-white placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
      />
    </div>
  </div>

  <!-- Category Pills -->
  {#if categoryFilters.length > 1}
    <div class="flex items-center gap-2 overflow-x-auto pt-4 pb-2">
      {#each categoryFilters as category}
        <button
          onclick={() => selectedCategory = category}
          class="px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors
            {selectedCategory === category 
              ? 'bg-primary text-white' 
              : 'bg-border-dark text-text-secondary hover:text-white'}"
        >
          {category}
        </button>
      {/each}
    </div>
  {/if}
</Card>

<!-- Transactions List -->
<Card padding="none">
  {#if loading}
    <div class="p-12 text-center">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
      <p class="text-text-muted mt-4">Loading transactions...</p>
    </div>
  {:else if filteredTransactions.length > 0}
    <div class="divide-y divide-border-dark">
      {#each filteredTransactions as transaction}
        <div class="flex items-center justify-between p-4 hover:bg-border-dark/30 transition-colors group">
          <div class="flex items-center gap-4">
            <div 
              class="flex h-12 w-12 items-center justify-center rounded-xl"
              style="background-color: {transaction.categoryColor}20; color: {transaction.categoryColor}"
            >
              <span class="material-symbols-outlined text-2xl">{transaction.categoryIcon}</span>
            </div>
            <div>
              <p class="font-semibold text-white">{transaction.payee || 'No payee'}</p>
              <div class="flex items-center gap-2 mt-0.5">
                <span class="text-xs text-text-muted">{transaction.categoryName}</span>
                <span class="text-xs text-text-muted">•</span>
                <span class="text-xs text-text-muted">{formatDate(transaction.date)}</span>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <span class="font-bold {transaction.type === 'income' ? 'text-primary' : 'text-white'}">
              {formatAmount(transaction.amount, transaction.type)}
            </span>
            {#if isCurrentMonth}
              <button
                onclick={() => deleteTransaction(transaction.id)}
                class="p-1 text-text-muted hover:text-danger opacity-0 group-hover:opacity-100 transition-all"
                title="Delete"
              >
                <span class="material-symbols-outlined text-lg">delete</span>
              </button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="p-12 text-center">
      <span class="material-symbols-outlined text-5xl text-text-muted mb-4">receipt_long</span>
      <h3 class="text-lg font-semibold text-white mb-2">No transactions for {selectedMonthYear}</h3>
      <p class="text-text-muted mb-6">
        {searchQuery || selectedCategory !== 'All' 
          ? 'Try adjusting your filters'
          : canAddTransaction ? 'Add your first transaction to get started' : ''}
      </p>
      {#if canAddTransaction && !searchQuery && selectedCategory === 'All'}
        <Button onclick={openAddModal}>
          {#snippet icon()}
            <span class="material-symbols-outlined">add</span>
          {/snippet}
          Add Transaction
        </Button>
      {/if}
    </div>
  {/if}
</Card>

<!-- Add Transaction Modal -->
{#if showAddModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
    <div class="bg-surface-dark rounded-2xl border border-border-dark w-full max-w-md mx-4 shadow-2xl">
      <div class="p-6 border-b border-border-dark">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-bold text-white">Add Transaction</h3>
          <button onclick={closeAddModal} class="text-text-muted hover:text-white">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
      </div>
      
      <div class="p-6 space-y-4">
        {#if addError}
          <div class="p-3 bg-danger/10 border border-danger/30 rounded-lg text-danger text-sm">
            {addError}
          </div>
        {/if}
        
        <!-- Type Toggle -->
        <div class="flex gap-2">
          <button
            onclick={() => newTransaction.type = 'expense'}
            class="flex-1 py-2 rounded-lg font-medium transition-colors
              {newTransaction.type === 'expense' ? 'bg-warning text-white' : 'bg-border-dark text-text-secondary'}"
          >
            Expense
          </button>
          <button
            onclick={() => newTransaction.type = 'income'}
            class="flex-1 py-2 rounded-lg font-medium transition-colors
              {newTransaction.type === 'income' ? 'bg-primary text-white' : 'bg-border-dark text-text-secondary'}"
          >
            Income
          </button>
        </div>
        
        <!-- Amount -->
        <div>
          <label for="tx-amount" class="block text-sm font-medium text-text-secondary mb-1.5">
            Amount ({currencies[selectedCurrency].symbol})
          </label>
          <input
            id="tx-amount"
            type="number"
            placeholder="0.00"
            bind:value={newTransaction.amount}
            class="w-full px-4 py-2.5 rounded-lg bg-bg-dark border border-border-dark text-white text-xl font-bold placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        
        <!-- Description -->
        <div>
          <label for="tx-desc" class="block text-sm font-medium text-text-secondary mb-1.5">Description</label>
          <input
            id="tx-desc"
            type="text"
            placeholder="e.g. Lunch at McD"
            bind:value={newTransaction.payee}
            class="w-full px-4 py-2.5 rounded-lg bg-bg-dark border border-border-dark text-white placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        
        <!-- Category (only for Expense) -->
        {#if newTransaction.type === 'expense'}
          <div>
            <label for="tx-category" class="block text-sm font-medium text-text-secondary mb-1.5">Category</label>
            <select
              id="tx-category"
              bind:value={newTransaction.categoryId}
              class="w-full px-4 py-2.5 rounded-lg bg-bg-dark border border-border-dark text-white focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Select category...</option>
              {#each availableCategories as cat}
                <option value={cat.id}>{cat.name}</option>
              {/each}
            </select>
          </div>
        {/if}
        
        <!-- Notes (Required for Other category) -->
        {#if isOtherCategory}
          <div class="p-3 bg-warning/10 border border-warning/30 rounded-lg">
            <label for="tx-notes" class="block text-sm font-medium text-warning mb-1.5">
              <span class="material-symbols-outlined text-sm align-middle">edit_note</span>
              What is this for? (Required)
            </label>
            <textarea
              id="tx-notes"
              placeholder="e.g. Travel expenses, Gift for friend, etc."
              bind:value={newTransaction.notes}
              rows="2"
              class="w-full px-4 py-2.5 rounded-lg bg-bg-dark border border-border-dark text-white placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-warning resize-none"
            ></textarea>
          </div>
        {/if}
        
        <!-- Date (restricted to current month, up to today) -->
        <div>
          <label for="tx-date" class="block text-sm font-medium text-text-secondary mb-1.5">
            Date <span class="text-text-muted text-xs">(current month only, up to today)</span>
          </label>
          <input
            id="tx-date"
            type="date"
            bind:value={newTransaction.date}
            min={monthStartStr}
            max={todayStr}
            class="w-full px-4 py-2.5 rounded-lg bg-bg-dark border border-border-dark text-white focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>
      
      <div class="p-6 border-t border-border-dark flex justify-end gap-3">
        <Button variant="secondary" onclick={closeAddModal} disabled={addingTransaction}>
          Cancel
        </Button>
        <Button onclick={addTransaction} loading={addingTransaction}>
          Add Transaction
        </Button>
      </div>
    </div>
  </div>
{/if}
