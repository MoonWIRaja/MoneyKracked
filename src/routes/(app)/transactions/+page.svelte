<script lang="ts">
  import { IsometricCard, PixelButton } from '$lib/components/ui';
  import { onMount, onDestroy } from 'svelte';
  import { type Currency } from '$lib/utils/currency';
  import { getExchangeRates, getUserPreferences, getCachedRatesSync, getCachedPreferencesSync } from '$lib/stores/app-store.svelte';
  import { subscribeToCurrency, convertAmountMYR, convertToMYR as convertToMYRStore } from '$lib/stores/currency-store';

  // Currency settings
  const currencies: Record<string, { symbol: string; locale: string }> = {
    'MYR': { symbol: 'RM', locale: 'en-MY' },
    'SGD': { symbol: 'S$', locale: 'en-SG' },
    'USD': { symbol: '$', locale: 'en-US' }
  };

  // PERFORMANCE: Cached formatters
  const formatters = {
    'en-MY': new Intl.NumberFormat('en-MY'),
    'en-SG': new Intl.NumberFormat('en-SG'),
    'en-US': new Intl.NumberFormat('en-US')
  };

  function formatNumber(amount: number, locale: string): string {
    return formatters[locale as keyof typeof formatters]?.format(amount) || amount.toLocaleString();
  }

  // PERFORMANCE: Cached date formatter
  const dateFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  // ============================================================
  // REACTIVE CURRENCY STATE - automatically updates UI on change
  // ============================================================
  let selectedCurrency = $state<Currency>((getCachedPreferencesSync()?.currency as Currency) || 'MYR');
  let exchangeRates = $state<Record<string, Record<string, number>>>(getCachedRatesSync() || {});
  
  // Month/Year selector
  const currentDate = new Date();
  let selectedMonth = $state(currentDate.getMonth()); // 0-11
  let selectedYear = $state(currentDate.getFullYear());
  
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  const years = Array.from({ length: 4 }, (_, i) => currentDate.getFullYear() - 2 + i);
  
  // Other category logic
  const otherCategory = { id: 'other', name: 'Other', icon: 'category', color: '#6b7280' };
  
  // Date restrictions
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
    notes?: string | null;
  }
  
  interface BudgetCategory {
    id: string;
    name: string;
    icon: string;
    color: string;
  }
  
  let transactions = $state<Transaction[]>([]);
  let budgetCategories = $state<BudgetCategory[]>([]);
  let loading = $state(true);
  
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

  // Delete Transaction Modal
  let showDeleteConfirmModal = $state(false);
  let deletingTransactionId = $state<string | null>(null);
  let deletingTransaction = $state(false);
  let deleteError = $state('');

  // Edit Transaction Modal
  let showEditModal = $state(false);
  let showEditConfirmModal = $state(false);
  let currentEditingTransaction = $state<Transaction | null>(null);
  let editingTransaction = $state(false);
  let editError = $state('');
  let editTransaction = $state({
    payee: '',
    amount: '',
    type: 'expense' as 'income' | 'expense',
    categoryId: '',
    date: '',
    notes: ''
  });

  const isEditOtherCategory = $derived(editTransaction.categoryId === 'other');
  const isOtherCategory = $derived(newTransaction.categoryId === 'other');
  
  const selectedMonthYear = $derived(`${months[selectedMonth]} ${selectedYear}`);
  
  const categoryFilters = $derived(['All', ...new Set(transactions.map(t => t.categoryName))]);

  let unsubscribeCurrency: (() => void) | undefined;

  onMount(async () => {
    const [rates, prefs] = await Promise.all([
      getExchangeRates(),
      getUserPreferences()
    ]);

    if (rates) exchangeRates = rates;
    if (prefs?.currency) selectedCurrency = prefs.currency;

    await fetchBudgetCategories();
    await fetchTransactions();

    unsubscribeCurrency = subscribeToCurrency((currency, rates) => {
      selectedCurrency = currency;
      exchangeRates = rates;
    });

    // Check for add=true parameter
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('add') === 'true' && canAddTransaction) {
      showAddModal = true;
      // Clean up the URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  });

  onDestroy(() => {
    unsubscribeCurrency?.();
  });

  function convertAmount(amountMYR: number): number {
    return convertAmountMYR(amountMYR, selectedCurrency, exchangeRates);
  }

  function convertToMYR(amount: number): number {
    return convertToMYRStore(amount, selectedCurrency, exchangeRates);
  }

  $effect(() => {
    const _ = selectedMonth + selectedYear;
    fetchTransactions();
  });

  async function fetchBudgetCategories() {
    try {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();
      
      const response = await fetch(`/api/budgets?month=${month}&year=${year}`, { credentials: 'include' });
      const result = await response.json();
      if (result.budgets) {
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

    if (isOtherCategory && !newTransaction.notes.trim()) {
      addError = 'Please add a note to describe what this transaction is for';
      return;
    }

    addingTransaction = true;
    addError = '';

    try {
      let categoryNameToSend: string | undefined;
      let categoryIdToSend: string | null = null;

      if (newTransaction.type === 'income') {
        categoryNameToSend = 'Income';
      } else if (newTransaction.type === 'expense') {
        if (isOtherCategory || !newTransaction.categoryId) {
          categoryNameToSend = 'Other';
        } else {
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
          amount: convertToMYR(parseFloat(newTransaction.amount)),
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
    deletingTransactionId = id;
    showDeleteConfirmModal = true;
  }

  async function confirmDelete() {
    if (!deletingTransactionId) return;

    deletingTransaction = true;
    deleteError = '';

    try {
      const response = await fetch(`/api/transactions/${deletingTransactionId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        transactions = transactions.filter(t => t.id !== deletingTransactionId);
        showDeleteConfirmModal = false;
        deletingTransactionId = null;
      } else {
        deleteError = 'Failed to delete transaction';
      }
    } catch (err) {
      console.error('Failed to delete transaction:', err);
      deleteError = 'Failed to delete transaction';
    } finally {
      deletingTransaction = false;
    }
  }

  function cancelDelete() {
    showDeleteConfirmModal = false;
    deletingTransactionId = null;
    deleteError = '';
  }

  function openEditModal(transaction: Transaction) {
    currentEditingTransaction = transaction;

    let formattedDate = transaction.date;
    if (transaction.date && !transaction.date.includes('T')) {
      formattedDate = transaction.date;
    } else if (transaction.date) {
      formattedDate = new Date(transaction.date).toISOString().split('T')[0];
    }

    editTransaction = {
      payee: transaction.payee || '',
      amount: String(convertAmount(transaction.amount)),
      type: transaction.type === 'transfer' ? 'expense' : transaction.type as 'income' | 'expense',
      categoryId: transaction.categoryName?.toLowerCase().replace(/\s+/g, '-') || '',
      date: formattedDate || new Date().toISOString().split('T')[0],
      notes: transaction.notes || ''
    };
    editError = '';
    showEditModal = true;
  }

  function closeEditModal() {
    showEditModal = false;
    currentEditingTransaction = null;
    editError = '';
  }

  function initiateSaveEdit() {
    if (!editTransaction.amount || !editTransaction.type) {
      editError = 'Amount and type are required';
      return;
    }

    if (isEditOtherCategory && !editTransaction.notes.trim()) {
      editError = 'Please add a note to describe what this transaction is for';
      return;
    }

    showEditConfirmModal = true;
  }

  async function confirmSaveEdit() {
    if (!currentEditingTransaction) return;

    editingTransaction = true;
    editError = '';

    try {
      let categoryNameToSend: string | undefined;
      let categoryIdToSend: string | null = null;

      if (editTransaction.type === 'income') {
        categoryNameToSend = 'Income';
      } else if (editTransaction.type === 'expense') {
        if (isEditOtherCategory || !editTransaction.categoryId) {
          categoryNameToSend = 'Other';
        } else {
          const selectedCat = availableCategories.find(c => c.id === editTransaction.categoryId);
          categoryNameToSend = selectedCat?.name;
        }
      }

      const response = await fetch(`/api/transactions/${currentEditingTransaction.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          payee: editTransaction.payee.trim() || (isEditOtherCategory ? editTransaction.notes : ''),
          amount: convertToMYR(parseFloat(editTransaction.amount)),
          type: editTransaction.type,
          categoryId: categoryIdToSend,
          categoryName: categoryNameToSend,
          date: editTransaction.date,
          notes: editTransaction.notes
        })
      });

      const data = await response.json();

      if (data.success) {
        showEditConfirmModal = false;
        showEditModal = false;
        await fetchTransactions();
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      editError = err.message || 'Failed to update transaction';
    } finally {
      editingTransaction = false;
    }
  }

  function cancelEditSave() {
    showEditConfirmModal = false;
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
  
  function formatAmount(amountMYR: number, type: string): string {
    const convertedAmount = convertAmount(amountMYR);
    const curr = currencies[selectedCurrency];
    const formatted = curr.symbol + ' ' + formatNumber(Math.abs(convertedAmount), curr.locale);
    return type === 'income' ? `+ ${formatted}` : `- ${formatted}`;
  }

  function formatDate(dateStr: string): string {
    return dateFormatter.format(new Date(dateStr));
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

<div class="flex h-[calc(100%+2rem)] lg:h-[calc(100%+4rem)] w-[calc(100%+4rem)] overflow-hidden bg-[var(--color-bg)] -m-4 lg:-m-8 border-black">
  <!-- Main Transactions Column -->
  <div class="flex-1 flex flex-col min-w-0 h-full relative bg-[var(--color-bg)]">
    <!-- App-like Inline Header -->
    <header class="h-20 flex items-center justify-between px-6 lg:px-10 border-b-4 border-black bg-[var(--color-surface-raised)] flex-shrink-0 z-20 shadow-lg">
      <div class="flex items-center gap-4">
        <div>
          <h2 class="text-xl font-display text-[var(--color-primary)]">TRANSACTION <span class="text-[var(--color-text)]">LOG</span></h2>
          <p class="text-[10px] font-mono text-[var(--color-text-muted)] flex items-center gap-2 uppercase">
            <span class="flex h-2 w-2 rounded-full bg-[var(--color-primary)] animate-pulse"></span>
            History For {selectedMonthYear}
          </p>
        </div>
      </div>
      
      <div class="flex items-center gap-4">
        <!-- Month/Year Selector -->
        <div class="hidden sm:flex items-center gap-2">
          <button
            onclick={() => {
              if (selectedMonth === 0) { selectedMonth = 11; selectedYear--; } 
              else { selectedMonth--; }
            }}
            class="h-10 w-10 border-2 border-black bg-[var(--color-surface)] flex items-center justify-center hover:bg-[var(--color-surface-raised)] transition-colors"
          >
            <span class="material-symbols-outlined">chevron_left</span>
          </button>
          
          <div class="flex h-10 items-center gap-2 px-3 border-2 border-black bg-[var(--color-surface)]">
            <select
              bind:value={selectedMonth}
              class="bg-transparent text-[var(--color-text)] font-mono text-[10px] uppercase font-bold focus:outline-none cursor-pointer"
            >
              {#each months as month, i}
                <option value={i} class="bg-[var(--color-surface)]">{month}</option>
              {/each}
            </select>
            <div class="w-px h-4 bg-black/20"></div>
            <select
              bind:value={selectedYear}
              class="bg-transparent text-[var(--color-text)] font-mono text-[10px] uppercase font-bold focus:outline-none cursor-pointer"
            >
              {#each years as year}
                <option value={year} class="bg-[var(--color-surface)]">{year}</option>
              {/each}
            </select>
          </div>
          
          <button
            onclick={() => {
              if (selectedMonth === 11) { selectedMonth = 0; selectedYear++; } 
              else { selectedMonth++; }
            }}
            class="h-10 w-10 border-2 border-black bg-[var(--color-surface)] flex items-center justify-center hover:bg-[var(--color-surface-raised)] transition-colors"
          >
            <span class="material-symbols-outlined">chevron_right</span>
          </button>
        </div>

        <!-- Add Transaction Button -->
        {#if canAddTransaction}
          <PixelButton onclick={openAddModal} variant="primary" class="h-10 text-[10px] py-2 px-4">
            <span class="material-symbols-outlined text-sm">add</span> ADD TRANSACTION
          </PixelButton>
        {/if}
      </div>
    </header>

    <!-- Scrollable Content Area -->
    <div class="flex-1 overflow-y-auto p-6 lg:p-10 space-y-8 scroll-smooth custom-scrollbar">

<!-- Status Messages -->
{#if isFutureMonth}
  <div class="mb-6 p-4 bg-[var(--color-warning)]/10 border-2 border-dashed border-[var(--color-warning)] text-[var(--color-warning)] flex items-center gap-3 shadow-sm">
    <span class="material-symbols-outlined">schedule</span>
    <span class="font-mono text-sm">Cannot add transactions for future months</span>
  </div>
{:else if isPastMonth}
  <div class="mb-6 p-4 bg-[var(--color-surface-raised)] border-2 border-[var(--color-border)] text-[var(--color-text-muted)] flex items-center gap-3 shadow-sm">
    <span class="material-symbols-outlined">history</span>
    <span class="font-mono text-sm">Viewing past transactions (read-only)</span>
  </div>
{/if}

<!-- Filters -->
<IsometricCard class="mb-6">
  <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
    <!-- Search -->
    <div class="relative flex-1 max-w-sm">
      <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">search</span>
      <input
        type="text"
        placeholder="Search logs..."
        bind:value={searchQuery}
        class="iso-input"
      />
    </div>
  </div>

  <!-- Category Pills -->
  {#if categoryFilters.length > 1}
    <div class="flex items-center gap-2 overflow-x-auto pt-4 pb-1 scrollbar-hide">
      {#each categoryFilters as category}
        <button
          onclick={() => selectedCategory = category}
          class="px-3 py-1.5 border-2 text-xs font-bold font-mono transition-transform hover:-translate-y-1 block
            {selectedCategory === category 
              ? 'bg-[var(--color-primary)] text-black border-[var(--color-border)] shadow-[2px_2px_0px_0px_var(--color-shadow)]' 
              : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:bg-[var(--color-surface-raised)]'}"
        >
          {category}
        </button>
      {/each}
    </div>
  {/if}
</IsometricCard>

<!-- Transactions List -->
<IsometricCard title="Transaction Log">
  {#if loading}
    <div class="p-12 text-center flex flex-col items-center">
      <div class="inline-block animate-spin h-8 w-8 border-4 border-[var(--color-primary)] border-t-transparent mb-4"></div>
      <p class="text-[var(--color-text-muted)] font-mono">Loading Data...</p>
    </div>
  {:else if filteredTransactions.length > 0}
    <div class="flex flex-col gap-3">
      {#each filteredTransactions as transaction}
        <div class="flex items-center justify-between p-4 border-2 border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm hover:translate-x-1 transition-transform group">
          <div class="flex items-center gap-4">
            <div 
              class="flex h-12 w-12 items-center justify-center border-2 border-[var(--color-border)] shadow-[2px_2px_0px_0px_var(--color-shadow)]"
              style="background-color: {transaction.categoryColor}20; color: {transaction.categoryColor}"
            >
              <span class="material-symbols-outlined text-2xl">{transaction.categoryIcon}</span>
            </div>
            <div>
              <p class="font-bold text-[var(--color-text)] font-ui">{transaction.payee || 'No payee'}</p>
              <div class="flex items-center gap-2 mt-0.5">
                <span class="text-xs text-[var(--color-text-muted)] font-mono uppercase bg-[var(--color-surface-raised)] px-1 border border-[var(--color-border)]">{transaction.categoryName}</span>
                <span class="text-xs text-[var(--color-text-muted)] font-mono">{formatDate(transaction.date)}</span>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-4">
            <span class="font-bold font-mono text-lg {transaction.type === 'income' ? 'text-[var(--color-success)]' : 'text-[var(--color-text)]'}">
              {formatAmount(transaction.amount, transaction.type)}
            </span>
            {#if isCurrentMonth}
              <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onclick={() => openEditModal(transaction)}
                  class="p-2 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-surface-raised)] border-2 border-transparent hover:border-[var(--color-border)] transition-all"
                  title="Edit"
                >
                  <span class="material-symbols-outlined text-lg">edit</span>
                </button>
                <button
                  onclick={() => deleteTransaction(transaction.id)}
                  class="p-2 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-surface-raised)] border-2 border-transparent hover:border-[var(--color-border)] transition-all"
                  title="Delete"
                >
                  <span class="material-symbols-outlined text-lg">delete</span>
                </button>
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="p-16 text-center">
      <span class="material-symbols-outlined text-5xl text-[var(--color-text-muted)] mb-4">receipt_long</span>
      <h3 class="text-lg font-bold text-[var(--color-text)] mb-2 font-display uppercase">Log is Empty</h3>
      <p class="text-[var(--color-text-muted)] mb-6 font-mono text-sm">
        {searchQuery || selectedCategory !== 'All' 
          ? 'No matches found.'
          : canAddTransaction ? 'Start tracking your spending now.' : 'No data.'}
      </p>
      {#if canAddTransaction && !searchQuery && selectedCategory === 'All'}
        <PixelButton onclick={openAddModal} variant="primary">
            <span class="material-symbols-outlined">add</span>
            Add First Transaction
        </PixelButton>
      {/if}
    </div>
  {/if}
</IsometricCard>
  </div>
</div>
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

<!-- Add/Edit Transaction Modal (Reused styles) -->
{#if showAddModal || showEditModal}
    {@const isAdd = showAddModal}
    {@const currentTx = isAdd ? newTransaction : editTransaction}
    {@const errorMsg = isAdd ? addError : editError}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
        <div class="bg-[var(--color-surface)] rounded-none w-full max-w-md border-4 border-[var(--color-border)] shadow-[var(--shadow-primary)]">
            <div class="flex items-center justify-between p-4 border-b-4 border-[var(--color-border)] bg-[var(--color-surface-raised)]">
                <h3 class="text-lg font-bold text-[var(--color-text)] font-display uppercase">{isAdd ? 'New Entry' : 'Edit Entry'}</h3>
                <button onclick={isAdd ? closeAddModal : closeEditModal} class="text-[var(--color-text-muted)] hover:text-[var(--color-danger)]">
                    <span class="material-symbols-outlined font-bold">close</span>
                </button>
            </div>
            
            <div class="p-6 space-y-5">
                <!-- Helper vars -->
                
                {#if errorMsg}
                    <div class="p-3 bg-[var(--color-danger)]/10 border-2 border-[var(--color-danger)] text-[var(--color-danger)] font-mono text-xs">
                        {errorMsg}
                    </div>
                {/if}
                
                <div class="flex gap-3">
                    <button 
                        onclick={() => currentTx.type = 'expense'}
                        class="flex-1 py-2 font-bold font-display text-xs uppercase border-2 border-[var(--color-border)] transition-all
                        {currentTx.type === 'expense' ? 'bg-[var(--color-warning)] text-black shadow-[2px_2px_0px_0px_var(--color-shadow)] translate-y-[-2px]' : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)]'}"
                    >Expense</button>
                    <button 
                        onclick={() => currentTx.type = 'income'}
                        class="flex-1 py-2 font-bold font-display text-xs uppercase border-2 border-[var(--color-border)] transition-all
                        {currentTx.type === 'income' ? 'bg-[var(--color-primary)] text-black shadow-[2px_2px_0px_0px_var(--color-shadow)] translate-y-[-2px]' : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)]'}"
                    >Income</button>
                </div>
                
                <div>
                   <label for="tx-amount" class="block text-xs font-bold text-[var(--color-text-muted)] font-mono mb-1 uppercase">Amount ({currencies[selectedCurrency].symbol})</label>
                   <input id="tx-amount" type="number" bind:value={currentTx.amount} placeholder="0.00" class="iso-input text-xl font-bold font-mono" />
                </div>
                
                <div>
                   <label for="tx-desc" class="block text-xs font-bold text-[var(--color-text-muted)] font-mono mb-1 uppercase">Payee / Description</label>
                   <input id="tx-desc" type="text" bind:value={currentTx.payee} placeholder="..." class="iso-input" />
                </div>
                
                {#if currentTx.type === 'expense'}
                    <div>
                        <label for="tx-cat" class="block text-xs font-bold text-[var(--color-text-muted)] font-mono mb-1 uppercase">Category</label>
                         <div class="relative">
                            <select id="tx-cat" bind:value={currentTx.categoryId} class="iso-input appearance-none">
                                <option value="">Select Category...</option>
                                {#each availableCategories as cat}
                                    <option value={cat.id}>{cat.name}</option>
                                {/each}
                            </select>
                            <span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-text-muted)]">expand_more</span>
                        </div>
                    </div>
                {/if}

                {#if (isAdd ? isOtherCategory : isEditOtherCategory)}
                    <div class="p-3 bg-[var(--color-warning)]/10 border-2 border-dashed border-[var(--color-warning)]">
                        <label for="tx-notes" class="block text-xs font-bold text-[var(--color-warning)] font-mono mb-1 uppercase">Notes (Required)</label>
                        <textarea id="tx-notes" bind:value={currentTx.notes} rows="2" class="w-full bg-[var(--color-bg)] border-2 border-[var(--color-border)] text-[var(--color-text)] p-2 font-mono text-sm focus:outline-none focus:border-[var(--color-warning)]"></textarea>
                    </div>
                {/if}

                 <div>
                   <label for="tx-date" class="block text-xs font-bold text-[var(--color-text-muted)] font-mono mb-1 uppercase">Date</label>
                   <input id="tx-date" type="date" bind:value={currentTx.date} class="iso-input font-mono" />
                </div>
            </div>
            
            <div class="p-4 border-t-4 border-[var(--color-border)] bg-[var(--color-surface-raised)] flex justify-end gap-3">
                <PixelButton variant="ghost" onclick={isAdd ? closeAddModal : closeEditModal}>Cancel</PixelButton>
                <PixelButton variant="primary" onclick={isAdd ? addTransaction : initiateSaveEdit}>
                     {isAdd ? 'Add Entry' : 'Save Changes'}
                </PixelButton>
            </div>
        </div>
    </div>
{/if}

<!-- Helper Modals (Delete/Edit Confirm) -->
{#if showDeleteConfirmModal}
    <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <div class="bg-[var(--color-surface)] border-4 border-[var(--color-border)] shadow-[var(--shadow-primary)] p-6 max-w-sm text-center">
            <span class="material-symbols-outlined text-5xl text-[var(--color-danger)] mb-4">delete_forever</span>
            <h3 class="text-xl font-bold text-[var(--color-text)] font-display uppercase mb-2">Delete Entry?</h3>
            <p class="text-[var(--color-text-muted)] font-mono text-sm mb-6">This action cannot be undone.</p>
            <div class="flex justify-center gap-4">
                <PixelButton variant="ghost" onclick={cancelDelete} disabled={deletingTransaction}>Cancel</PixelButton>
                <PixelButton variant="danger" onclick={confirmDelete} loading={deletingTransaction}>Delete It</PixelButton>
            </div>
        </div>
    </div>
{/if}

<!-- Edit Confirm Modal (Simpler version) -->
{#if showEditConfirmModal}
     <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <div class="bg-[var(--color-surface)] border-4 border-[var(--color-border)] shadow-[var(--shadow-primary)] p-6 max-w-sm text-center">
            <span class="material-symbols-outlined text-5xl text-[var(--color-primary)] mb-4">save</span>
            <h3 class="text-xl font-bold text-[var(--color-text)] font-display uppercase mb-2">Save Changes?</h3>
             {#if editError} <p class="text-danger text-xs font-mono">{editError}</p> {/if}
            <div class="flex justify-center gap-4 mt-4">
                <PixelButton variant="ghost" onclick={cancelEditSave} disabled={editingTransaction}>Back</PixelButton>
                <PixelButton variant="primary" onclick={confirmSaveEdit} loading={editingTransaction}>Confirm</PixelButton>
            </div>
        </div>
    </div>
{/if}
