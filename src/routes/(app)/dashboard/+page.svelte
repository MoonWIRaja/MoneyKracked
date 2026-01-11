<script lang="ts">
  import { KPICard, SpendingChart, RecentExpenses } from '$lib/components/dashboard';
  import { IsometricCard, PixelButton } from '$lib/components/ui';
  import { goto, invalidateAll } from '$app/navigation';
  import { onMount } from 'svelte';
  import { type Currency } from '$lib/utils/currency';
  import { subscribeToCurrencyLazy, convertAmountMYR } from '$lib/stores/currency-store';
  import { toggleSidebar } from '$lib/stores/app-store.svelte';

  interface ServerBudget {
    id: string;
    categoryName: string;
    categoryIcon: string;
    categoryColor: string;
    limitAmount: number;
    spent: number;
  }

  interface ServerTransaction {
    id: string;
    payee: string;
    amount: number;
    type: string;
    date: string;
    categoryName: string;
    categoryIcon: string;
    categoryColor: string;
  }

  interface PageData {
    currency: string;
    month: number;
    year: number;
    budgets: ServerBudget[];
    transactions: ServerTransaction[];
    rates?: Record<string, Record<string, number>>;
  }

  interface Props {
    data: PageData;
    children?: any;
  }

  let { data }: Props = $props();

  // Currency settings
  const currencies: Record<string, { symbol: string; locale: string }> = {
    'MYR': { symbol: 'RM', locale: 'en-MY' },
    'SGD': { symbol: 'S$', locale: 'en-SG' },
    'USD': { symbol: '$', locale: 'en-US' }
  };

  // PERFORMANCE: Move color mapping outside component to avoid recreation
  const colorClassMap: Record<string, { bg: string; text: string }> = {
    '#21c462': { bg: 'bg-green-500/20', text: 'text-green-500' },
    '#10b981': { bg: 'bg-emerald-500/20', text: 'text-emerald-500' },
    '#3b82f6': { bg: 'bg-blue-500/20', text: 'text-blue-500' },
    '#f59e0b': { bg: 'bg-amber-500/20', text: 'text-amber-500' },
    '#ef4444': { bg: 'bg-red-500/20', text: 'text-red-500' },
    '#8b5cf6': { bg: 'bg-violet-500/20', text: 'text-violet-500' },
    '#ec4899': { bg: 'bg-pink-500/20', text: 'text-pink-500' },
    '#06b6d4': { bg: 'bg-cyan-500/20', text: 'text-cyan-500' },
    '#f97316': { bg: 'bg-orange-500/20', text: 'text-orange-500' },
    '#6366f1': { bg: 'bg-indigo-500/20', text: 'text-indigo-500' },
    '#84cc16': { bg: 'bg-lime-500/20', text: 'text-lime-500' },
    '#14b8a6': { bg: 'bg-teal-500/20', text: 'text-teal-500' },
    '#6b7280': { bg: 'bg-gray-500/20', text: 'text-gray-500' }
  };

  // PERFORMANCE: Cached formatters for each currency
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
  let selectedCurrency = $state<Currency>('MYR');
  let exchangeRates = $state<Record<string, Record<string, number>>>({});

  // UI state
  let loading = $state(false);

  // Reactive state for computed data - these are the ONLY reactive states
  let budgets = $state<any[]>([]);
  let spendingData = $state<any[]>([]);
  let recentExpenses = $state<any[]>([]);
  let formattedTotalDeposits = $state('-');
  let formattedTotalSpent = $state('-');
  let formattedRemaining = $state('-');
  let formattedTotalWithIncome = $state('-');
  let remainingBudgetValue = $state(0);
  let remainingBudgetFormatted = $state('-');
  let remainingBudgetPercentage = $state(100);
  let overspentCategoriesList = $state<any[]>([]);
  let overspentCategoriesCount = $state(0);
  let currentCurrencySymbol = $state('RM');
  let currentCurrencyLocale = $state('en-MY');

  // Pre-computed overspent items for modal (with converted values)
  let overspentItemsForModal = $state<Array<{
    id: string;
    categoryName: string;
    categoryIcon: string;
    categoryColor: string;
    limitAmount: number;
    spent: number;
    overAmount: number;
    currencySymbol: string;
    currencyLocale: string;
  }>>([]);

  // ============================================================
  // Guard condition to prevent redundant updates
  // ============================================================
  let lastProcessedCurrency = '';
  let lastProcessedRatesHash = '';

  function getRatesHash(rates: Record<string, Record<string, number>>): string {
    return JSON.stringify(rates);
  }

  // ============================================================
  // Process dashboard data - called manually when dependencies change
  // Uses guard condition to prevent redundant processing
  // ============================================================
  function processDashboardData() {
    // GUARD: Skip if currency and rates haven't changed
    const currencyKey = selectedCurrency;
    const ratesHash = getRatesHash(exchangeRates);
    if (lastProcessedCurrency === currencyKey && lastProcessedRatesHash === ratesHash) {
      return; // Already processed with these values
    }
    lastProcessedCurrency = currencyKey;
    lastProcessedRatesHash = ratesHash;

    const txs = data?.transactions || [];
    const budgetsData = data?.budgets || [];
    const curr = currencies[selectedCurrency] || currencies['MYR'];

    // 1. Process Income & Spent by Category (Base MYR)
    let incomeTotalMYR = 0;
    const spentByCategoryMYR: Record<string, number> = {};

    for (const tx of txs) {
      if (tx.type === 'income') {
        incomeTotalMYR += tx.amount;
      } else if (tx.type === 'expense') {
        const catName = tx.categoryName || 'Other';
        spentByCategoryMYR[catName] = (spentByCategoryMYR[catName] || 0) + tx.amount;
      }
    }

    // 2. Budgets with spent amounts (Base MYR)
    const baseBudgets = budgetsData.map((b: ServerBudget) => ({
      ...b,
      spent: spentByCategoryMYR[b.categoryName] || 0
    }));

    // 3. Converted Values for UI
    const convert = (val: number) => convertAmountMYR(val, selectedCurrency, exchangeRates);
    const fmt = (val: number) => curr.symbol + ' ' + formatNumber(val, curr.locale);

    const converted = baseBudgets.map(b => ({
      ...b,
      limitAmount: convert(b.limitAmount),
      spent: convert(b.spent)
    }));

    const budgetLimitsConverted = converted.reduce((sum, b) => sum + b.limitAmount, 0);
    const incomeTotalConverted = convert(incomeTotalMYR);
    const totalAvailableConverted = budgetLimitsConverted + incomeTotalConverted;
    const totalSpentConverted = Object.values(spentByCategoryMYR).reduce((sum, amt) => sum + convert(amt), 0);
    const remainingConverted = totalAvailableConverted - totalSpentConverted;

    // 4. Chart Data
    const budgetCategoryNames = new Set(budgetsData.map((b: ServerBudget) => b.categoryName));
    const spendingDataMap: Array<{ name: string; value: number; percentage: number; color: string; formattedValue: string }> = [];

    for (const b of converted) {
      if (b.categoryName === 'Income') continue;
      spendingDataMap.push({
        name: b.categoryName,
        value: b.spent,
        percentage: totalAvailableConverted > 0 ? (b.spent / totalAvailableConverted) * 100 : 0,
        color: b.categoryColor,
        formattedValue: fmt(b.spent)
      });
    }

    if (!budgetCategoryNames.has('Other')) {
      const otherSpentConverted = convert(spentByCategoryMYR['Other'] || 0);
      spendingDataMap.push({
        name: 'Other',
        value: otherSpentConverted,
        percentage: totalAvailableConverted > 0 ? (otherSpentConverted / totalAvailableConverted) * 100 : 0,
        color: '#6b7280',
        formattedValue: fmt(otherSpentConverted)
      });
    }
    spendingDataMap.sort((a, b) => b.value - a.value);

    // 5. Recent Expenses
    const budgetMap = new Map(converted.map(b => [b.categoryName, b]));
    const recent = txs.slice(0, 5).map(tx => {
      const category = budgetMap.get(tx.categoryName);
      const color = tx.categoryColor || category?.categoryColor || '#6b7280';
      const colorClasses = colorClassMap[color.toLowerCase()] || colorClassMap['#6b7280'];
      return {
        id: tx.id,
        payee: tx.payee,
        amount: convert(tx.amount),
        date: tx.date,
        icon: tx.categoryIcon || category?.categoryIcon || 'receipt',
        iconColor: colorClasses.text,
        iconBg: colorClasses.bg
      };
    });

    const overspentList = baseBudgets.filter(b => b.spent > b.limitAmount);

    // Pre-compute overspent items for modal (with converted values)
    const modalItems = overspentList.map(b => ({
      id: b.id,
      categoryName: b.categoryName,
      categoryIcon: b.categoryIcon,
      categoryColor: b.categoryColor,
      limitAmount: convert(b.limitAmount),
      spent: convert(b.spent),
      overAmount: convert(b.spent) - convert(b.limitAmount),
      currencySymbol: curr.symbol,
      currencyLocale: curr.locale
    }));

    // Update all reactive state (batched)
    budgets = baseBudgets;
    spendingData = spendingDataMap;
    recentExpenses = recent;
    formattedTotalDeposits = totalAvailableConverted === 0 ? '-' : fmt(totalAvailableConverted);
    formattedTotalSpent = totalSpentConverted === 0 ? '-' : fmt(totalSpentConverted);
    formattedRemaining = (remainingConverted === 0 && totalAvailableConverted === 0) ? '-' : fmt(remainingConverted);
    formattedTotalWithIncome = totalAvailableConverted === 0 ? '-' : fmt(totalAvailableConverted);
    remainingBudgetValue = remainingConverted;
    remainingBudgetFormatted = fmt(remainingConverted);
    remainingBudgetPercentage = totalAvailableConverted > 0 ? (remainingConverted / totalAvailableConverted) * 100 : 100;
    overspentCategoriesList = overspentList;
    overspentCategoriesCount = overspentList.length;
    overspentItemsForModal = modalItems;
    currentCurrencySymbol = curr.symbol;
    currentCurrencyLocale = curr.locale;
  }

  // ============================================================
  // Initialize data on mount
  // ============================================================
  onMount(() => {
    // Check for auth_token in sessionStorage (from OAuth callback)
    const storedToken = sessionStorage.getItem('auth_token');
    if (storedToken) {
      console.log('[Dashboard] Found auth_token, syncing session...');
      fetch('/api/auth/set-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token: storedToken })
      })
      .then(res => res.json())
      .then(() => {
        sessionStorage.removeItem('auth_token');
        window.location.reload();
      })
      .catch(console.error);
      return;
    }

    // Initialize currency from props
    if (data.currency) selectedCurrency = data.currency as Currency;
    if (data.rates) exchangeRates = data.rates;

    // Process initial data
    processDashboardData();

    // Subscribe to currency changes using lazy subscription (no immediate callback)
    const unsubscribe = subscribeToCurrencyLazy((currency: Currency, rates: Record<string, Record<string, number>>) => {
      selectedCurrency = currency;
      exchangeRates = rates;
      // Manually trigger data processing
      processDashboardData();
    });

    return () => {
      unsubscribe();
    };
  });

  // Overspent Modal State
  let showOverspentModal = $state(false);
  let overspentAdvice = $state('');
  let overspentLoading = $state(false);
  let overspentError = $state('');

  // Open overspent modal and fetch AI advice
  async function openOverspentModal() {
    if (overspentCategoriesCount === 0) return;

    showOverspentModal = true;
    overspentLoading = true;
    overspentError = '';
    overspentAdvice = '';

    try {
      const curr = currencies[selectedCurrency] || currencies['MYR'];
      const overspentDetails = overspentCategoriesList.map(b => {
        const convLimit = convertAmountMYR(b.limitAmount, selectedCurrency, exchangeRates);
        const convSpent = convertAmountMYR(b.spent, selectedCurrency, exchangeRates);
        return {
          category: b.categoryName,
          budget: curr.symbol + ' ' + formatNumber(convLimit, curr.locale),
          spent: curr.symbol + ' ' + formatNumber(convSpent, curr.locale),
          over: curr.symbol + ' ' + formatNumber(convSpent - convLimit, curr.locale)
        };
      });

      const response = await fetch('/api/ai-advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          type: 'overspent-analysis',
          data: overspentDetails
        })
      });

      const result = await response.json();
      if (result.success && result.advice) {
        overspentAdvice = result.advice;
      } else {
        overspentError = result.error || 'Failed to get advice';
      }
    } catch (err) {
      console.error('Failed to fetch overspent advice:', err);
      overspentError = 'Unable to connect to AI service. Please try again.';
    } finally {
      overspentLoading = false;
    }
  }

  // Handle color change from chart
  async function handleColorChange(categoryName: string, color: string) {
    try {
      const response = await fetch('/api/categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ categoryName, color })
      });

      const result = await response.json();

      if (result.success) {
        await invalidateAll();
      }
    } catch (err) {
      console.error('Failed to update color:', err);
    }
  }
</script>

<svelte:head>
  <title>Dashboard - MoneyKracked</title>
</svelte:head>

<div class="flex flex-col h-full w-full overflow-hidden bg-[var(--color-bg)]">
  <!-- Main Dashboard Column -->
  <div class="flex-1 flex flex-col min-w-0 h-full relative bg-[var(--color-bg)]">
    <!-- App-like Inline Header -->
    <header class="h-20 flex items-center justify-between px-6 lg:px-10 border-b-4 border-black bg-[var(--color-surface-raised)] flex-shrink-0 z-20 shadow-lg">
      <div class="flex items-center gap-4">
        <button class="lg:hidden mr-2 p-2 -ml-2 text-[var(--color-text)] hover:bg-[var(--color-surface)] rounded-none transition-colors" onclick={toggleSidebar}>
          <span class="material-symbols-outlined">menu</span>
        </button>
        <div class="flex flex-col flex-1 min-w-0">
          <h2 class="text-base md:text-xl font-display text-[var(--color-primary)] truncate"><span class="hidden sm:inline">DAILY </span>DASHBOARD</h2>
          <p class="text-[9px] md:text-[10px] font-mono text-[var(--color-text-muted)] flex items-center gap-2 uppercase">
            <span class="flex h-2 w-2 rounded-full bg-[var(--color-primary)] animate-pulse"></span>
            Overview • {data.month}/{data.year}
          </p>
        </div>
      </div>
      
      <div class="flex items-center gap-4">
        <button class="h-10 w-10 border-2 border-black bg-[var(--color-surface)] flex items-center justify-center hover:bg-[var(--color-surface-raised)] transition-colors" onclick={() => invalidateAll()}>
          <span class="material-symbols-outlined">refresh</span>
        </button>
      </div>
    </header>

    <!-- Scrollable Content Area -->
    <div class="flex-1 overflow-y-auto p-6 lg:p-10 space-y-10 scroll-smooth custom-scrollbar">

<!-- KPI Cards -->
<section class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
  <KPICard
    title="Total Budget"
    value={formattedTotalDeposits}
    icon="payments"
    iconColor="blue"
    valueColor="primary"
    clickable={true}
    onclick={() => goto('/budget')}
  />

  <KPICard
    title="Total Spent"
    value={formattedTotalSpent}
    icon="receipt_long"
    iconColor="orange"
    clickable={true}
    onclick={() => goto('/transactions')}
  />

  <KPICard
    title="Remaining"
    value={formattedRemaining}
    valueColor={remainingBudgetValue >= 0 ? 'primary' : 'danger'}
    icon="account_balance_wallet"
    iconColor={remainingBudgetValue >= 0 ? 'green' : 'red'}
    clickable={true}
    onclick={() => goto('/budget')}
  />

  <KPICard
    title="Warnings"
    value={overspentCategoriesCount > 0 ? `${overspentCategoriesCount} Categories` : 'Clear'}
    icon="warning"
    iconColor={overspentCategoriesCount > 0 ? 'red' : 'green'}
    clickable={overspentCategoriesCount > 0}
    onclick={openOverspentModal}
  />
</section>

<!-- Overspent Advice Modal -->
{#if showOverspentModal}
  <div
    class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
    onclick={() => showOverspentModal = false}
    onkeydown={(e) => e.key === 'Escape' && (showOverspentModal = false)}
    role="button"
    tabindex="-1"
  >
    <!-- Pixel Art Modal -->
    <div class="bg-[var(--color-surface)] rounded-none w-full max-w-lg overflow-hidden border-4 border-[var(--color-border)] shadow-[var(--shadow-primary)]" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()} role="dialog" aria-modal="true" tabindex="0">
      <!-- Header -->
      <div class="flex items-center justify-between p-4 border-b-4 border-[var(--color-border)] bg-[var(--color-surface-raised)]">
        <div class="flex items-center gap-3">
          <span class="material-symbols-outlined text-3xl text-[var(--color-danger)]">warning</span>
          <div>
            <h3 class="text-lg font-display uppercase tracking-wider text-[var(--color-text)]">Overspent!</h3>
          </div>
        </div>
        <button
          onclick={() => showOverspentModal = false}
          class="text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors p-1"
        >
          <span class="material-symbols-outlined font-bold">close</span>
        </button>
      </div>

      <!-- Content -->
      <div class="p-6 overflow-y-auto max-h-[60vh]">
        {#if overspentLoading}
          <div class="flex flex-col items-center justify-center py-8">
            <div class="inline-block animate-spin h-10 w-10 border-4 border-[var(--color-primary)] border-t-transparent mb-4"></div>
            <p class="text-[var(--color-text-muted)] font-mono">Scanning Finances...</p>
          </div>
        {:else if overspentError}
          <div class="bg-danger/10 border-2 border-[var(--color-danger)] p-4 text-[var(--color-danger)] font-mono">
            <p class="flex items-center gap-2">
              <span class="material-symbols-outlined text-sm">error</span>
              {overspentError}
            </p>
          </div>
        {:else}
          <!-- Overspent List -->
          <div class="space-y-4 mb-6">
            {#each overspentItemsForModal as item}
              <div class="bg-[var(--color-bg)] rounded-none p-4 border-2 border-[var(--color-border)] shadow-inner">
                <div class="flex items-center justify-between mb-2">
                  <div class="flex items-center gap-2">
                    <span class="material-symbols-outlined" style="color: {item.categoryColor}">{item.categoryIcon}</span>
                    <span class="font-bold text-[var(--color-text)] font-ui">{item.categoryName}</span>
                  </div>
                  <span class="text-[var(--color-danger)] font-bold font-mono">+{item.currencySymbol} {formatNumber(item.overAmount, item.currencyLocale)}</span>
                </div>
                <!-- Progress Bar -->
                <div class="mt-2 h-4 bg-[var(--color-surface)] border-2 border-[var(--color-border)] relative">
                  <div
                    class="h-full bg-[var(--color-danger)] absolute top-0 left-0"
                    style="width: {Math.min((item.spent / item.limitAmount) * 100, 100)}%"
                  ></div>
                </div>
              </div>
            {/each}
          </div>

          <!-- AI Advice -->
          {#if overspentAdvice}
            <div class="bg-[var(--color-primary)]/10 border-2 border-dashed border-[var(--color-primary)] p-4">
              <div class="flex items-center gap-2 mb-3">
                <span class="material-symbols-outlined text-[var(--color-primary)]">psychology</span>
                <h4 class="font-bold text-[var(--color-text)] font-display text-sm uppercase">AI Analysis</h4>
              </div>
              <div class="text-[var(--color-text)] whitespace-pre-wrap text-sm leading-relaxed font-mono">
                {overspentAdvice}
              </div>
            </div>
          {/if}
        {/if}
      </div>

      <!-- Footer -->
      <div class="flex justify-end gap-3 p-4 border-t-4 border-[var(--color-border)] bg-[var(--color-surface-raised)]">
        <PixelButton variant="ghost" onclick={() => showOverspentModal = false}>
            Close
        </PixelButton>

        {#if overspentCategoriesCount > 0 && !overspentLoading}
          <PixelButton
            variant="primary"
            onclick={() => {
              // Use pre-computed overspent items (no currency state access needed)
              sessionStorage.setItem('overspentContext', JSON.stringify(overspentItemsForModal));
              goto('/coach');
            }}
          >
            <span class="material-symbols-outlined text-sm">chat</span>
            Ask Coach
          </PixelButton>
        {/if}
      </div>
    </div>
  </div>
{/if}

<!-- Charts & Details Grid -->
<section class="grid grid-cols-1 gap-6 lg:grid-cols-3 mt-6">
  <!-- Spending Chart (2 columns) -->
  <div class="lg:col-span-2">
    {#if loading}
      <IsometricCard class="flex flex-col items-center justify-center min-h-[300px]">
        <div class="inline-block animate-spin h-8 w-8 border-4 border-[var(--color-primary)] border-t-transparent"></div>
        <p class="text-[var(--color-text-muted)] mt-4 font-mono">Loading Budget...</p>
      </IsometricCard>
    {:else if spendingData.length > 0}
      <SpendingChart
        data={spendingData}
        total={formattedTotalWithIncome}
        remainingBudget={{
          value: remainingBudgetValue,
          formattedValue: remainingBudgetFormatted,
          percentage: remainingBudgetPercentage
        }}
        onColorChange={handleColorChange}
      />
    {:else}
      <IsometricCard class="flex flex-col items-center justify-center min-h-[300px] text-center">
        <span class="material-symbols-outlined text-5xl text-[var(--color-text-muted)] mb-4">pie_chart</span>
        <h3 class="text-lg font-bold text-[var(--color-text)] mb-2 font-display uppercase">No Data Found</h3>
        <p class="text-[var(--color-text-muted)] max-w-sm font-mono text-sm">
          Initialize your budget to see data.
        </p>
        <div class="mt-4">
            <PixelButton variant="primary" onclick={() => goto('/budget')}>
                <span class="material-symbols-outlined">add</span>
                <span>Set Up Budget</span>
            </PixelButton>
        </div>
      </IsometricCard>
    {/if}
  </div>

  <!-- Recent Expenses (1 column) -->
  <div class="lg:col-span-1">
    {#if recentExpenses.length > 0}
      <RecentExpenses expenses={recentExpenses} currency={currentCurrencySymbol} />
    {:else}
      <IsometricCard class="flex flex-col items-center justify-center min-h-[300px] text-center">
        <span class="material-symbols-outlined text-5xl text-[var(--color-text-muted)] mb-4">receipt_long</span>
        <h3 class="text-lg font-bold text-[var(--color-text)] mb-2 font-display uppercase">Empty Log</h3>
        <p class="text-[var(--color-text-muted)] font-mono text-sm">
          No transactions recorded.
        </p>
      </IsometricCard>
    {/if}
  </div>
    </section>
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
