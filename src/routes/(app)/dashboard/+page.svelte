<script lang="ts">
  import { Header } from '$lib/components/layout';
  import { KPICard, SpendingChart, RecentExpenses } from '$lib/components/dashboard';
  import { onMount } from 'svelte';
  import { type Currency } from '$lib/utils/currency';

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
    rates: Record<string, Record<string, number>>;
    currency: string;
    month: number;
    year: number;
    budgets: ServerBudget[];
    transactions: ServerTransaction[];
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

  interface Budget {
    id: string;
    categoryName: string;
    categoryIcon: string;
    categoryColor: string;
    limitAmount: number;
    spent: number;
  }

  // Initialize with server-loaded data (instant display!)
  // Use destructuring to capture values at component creation
  const initialData = data;
  let selectedCurrency = $state<Currency>((initialData?.currency as Currency) || 'MYR');
  let exchangeRates = $state<Record<string, Record<string, number>>>(initialData?.rates || {});
  let budgets = $state<Budget[]>(initialData?.budgets || []);
  let loading = $state(false); // No loading needed - data is already here!

  // Spending chart data
  let spendingData: Array<{ name: string; value: number; percentage: number; color: string; formattedValue: string }> = $state([]);
  let remainingBudgetData = $state<{ value: number; formattedValue: string; percentage: number } | undefined>(undefined);
  let totalBudgetWithIncome = $state(0);
  let totalBudgetKPI = $state(0);
  let remainingBudgetKPI = $state(0);
  let recentExpenses: Array<{
    id: string;
    payee: string;
    amount: number;
    date: string;
    icon: string;
    iconColor: string;
    iconBg: string;
  }> = $state([]);

  // Computed values from budgets (for overspent categories only)
  const overspentCategories = $derived(budgets.filter(b => b.spent > b.limitAmount).length);

  // Convert amount from MYR to selected currency
  function convertAmount(amountMYR: number): number {
    if (selectedCurrency === 'MYR') return amountMYR;
    const rate = exchangeRates.MYR?.[selectedCurrency];
    if (rate) {
      return Math.round(amountMYR * rate * 100) / 100;
    }
    // Fallback default rates
    const defaultRates: Record<string, number> = { SGD: 0.31, USD: 0.22 };
    const fallbackRate = defaultRates[selectedCurrency];
    if (fallbackRate) {
      return Math.round(amountMYR * fallbackRate * 100) / 100;
    }
    return amountMYR;
  }

  // Process server data immediately (no API calls needed!)
  function processServerData() {
    const txs = initialData?.transactions || [];
    const budgetsData = initialData?.budgets || [];

    // Calculate income total and spending by category
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

    // Update budgets with spent amounts
    budgets = budgetsData.map((b: ServerBudget) => ({
      ...b,
      spent: convertAmount(spentByCategoryMYR[b.categoryName] || 0)
    }));

    // Convert budgets to selected currency for display
    const budgetsConverted = budgetsData.map((b: ServerBudget) => ({
      ...b,
      limitAmount: convertAmount(b.limitAmount),
      spent: convertAmount(spentByCategoryMYR[b.categoryName] || 0)
    }));

    // Total budget = budget limits + income (all converted)
    const budgetLimitsConverted = budgetsConverted.reduce((sum: number, b: any) => sum + b.limitAmount, 0);
    const incomeTotalConverted = convertAmount(incomeTotalMYR);
    const calculatedTotalWithIncome = budgetLimitsConverted + incomeTotalConverted;

    // Include all spending from spentByCategory
    const totalSpentAmountConverted = Object.values(spentByCategoryMYR).reduce((sum: number, amount: number) => sum + convertAmount(amount), 0);
    const totalRemainingAmount = calculatedTotalWithIncome - totalSpentAmountConverted;

    // Build chart data
    const curr = currencies[selectedCurrency];
    spendingData = [];

    const budgetCategoryNames = new Set(budgetsConverted.map((b: Budget) => b.categoryName));
    const fmt = (amount: number) => curr.symbol + ' ' + formatNumber(amount, curr.locale);

    // Add all budgeted categories
    for (const b of budgets) {
      if (b.categoryName === 'Income') continue;
      const spentConverted = convertAmount(spentByCategoryMYR[b.categoryName] || 0);
      spendingData.push({
        name: b.categoryName,
        value: spentConverted,
        percentage: calculatedTotalWithIncome > 0 ? (spentConverted / calculatedTotalWithIncome) * 100 : 0,
        color: b.categoryColor,
        formattedValue: fmt(spentConverted)
      });
    }

    // Add 'Other' category if not in budgets
    const otherSpentMYR = spentByCategoryMYR['Other'] || 0;
    const otherSpentConverted = convertAmount(otherSpentMYR);
    if (!budgetCategoryNames.has('Other')) {
      spendingData.push({
        name: 'Other',
        value: otherSpentConverted,
        percentage: calculatedTotalWithIncome > 0 ? (otherSpentConverted / calculatedTotalWithIncome) * 100 : 0,
        color: '#6b7280',
        formattedValue: fmt(otherSpentConverted)
      });
    }

    // Add 'Income' category
    if (!budgetCategoryNames.has('Income')) {
      spendingData.push({
        name: 'Income',
        value: incomeTotalConverted,
        percentage: calculatedTotalWithIncome > 0 ? (incomeTotalConverted / calculatedTotalWithIncome) * 100 : 0,
        color: '#10b981',
        formattedValue: fmt(incomeTotalConverted)
      });
    }

    // Populate recent expenses (top 5)
    const budgetMap = new Map<string, Budget>(budgetsConverted.map((b: Budget) => [b.categoryName, b]));

    recentExpenses = txs
      .slice(0, 5)
      .map((tx: ServerTransaction) => {
        const category = budgetMap.get(tx.categoryName);
        const icon = tx.categoryIcon || category?.categoryIcon || 'receipt';
        const color = tx.categoryColor || category?.categoryColor || '#6b7280';
        const colorClasses = colorClassMap[color.toLowerCase()] || colorClassMap['#6b7280'];

        return {
          id: tx.id,
          payee: tx.payee || 'No description',
          amount: convertAmount(tx.amount),
          date: tx.date,
          icon: icon,
          iconColor: colorClasses.text,
          iconBg: colorClasses.bg
        };
      });

    // Sort by value
    spendingData.sort((a, b) => {
      if (a.value === 0 && b.value === 0) return a.name.localeCompare(b.name);
      if (a.value === 0) return 1;
      if (b.value === 0) return -1;
      return b.value - a.value;
    });

    // Set KPI values
    totalBudgetWithIncome = calculatedTotalWithIncome;
    totalBudgetKPI = calculatedTotalWithIncome;
    remainingBudgetKPI = totalRemainingAmount;

    remainingBudgetData = {
      value: totalRemainingAmount,
      formattedValue: fmt(totalRemainingAmount),
      percentage: calculatedTotalWithIncome > 0 ? (totalRemainingAmount / calculatedTotalWithIncome) * 100 : 100
    };
  }

  // Process data immediately on mount (no API calls!)
  onMount(() => {
    processServerData();
  });

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
        spendingData = spendingData.map(item =>
          item.name === categoryName ? { ...item, color } : item
        );
      }
    } catch (err) {
      console.error('Failed to update color:', err);
    }
  }

  function formatAmount(amount: number): string {
    if (amount === 0 && totalBudgetKPI === 0) return '-';
    const curr = currencies[selectedCurrency];
    return curr.symbol + ' ' + formatNumber(amount, curr.locale);
  }
</script>

<svelte:head>
  <title>Dashboard - MoneyKracked</title>
</svelte:head>

<!-- Page Header -->
<Header
  title="Dashboard"
  subtitle="Welcome back! Here's your financial overview."
/>

<!-- KPI Cards -->
<section class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
  <KPICard
    title="Total Budget (This Month)"
    value={formatAmount(totalBudgetKPI)}
    icon="savings"
    iconColor="blue"
  />

  <KPICard
    title="Remaining Budget"
    value={formatAmount(remainingBudgetKPI)}
    valueColor={remainingBudgetKPI >= 0 ? 'primary' : 'danger'}
    icon="account_balance"
    iconColor={remainingBudgetKPI >= 0 ? 'green' : 'red'}
  />

  <KPICard
    title="Overspent Categories"
    value={overspentCategories > 0 ? `${overspentCategories} Categories` : 'None'}
    icon="warning"
    iconColor={overspentCategories > 0 ? 'red' : 'green'}
  />
</section>

<!-- Charts & Details Grid -->
<section class="grid grid-cols-1 gap-6 lg:grid-cols-3">
  <!-- Spending Chart (2 columns) -->
  <div class="lg:col-span-2">
    {#if loading}
      <div class="bg-surface-dark rounded-xl p-8 flex flex-col items-center justify-center border border-border-dark min-h-[300px]">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
        <p class="text-text-muted mt-4">Loading budget data...</p>
      </div>
    {:else if spendingData.length > 0}
      <SpendingChart
        data={spendingData}
        total={formatAmount(totalBudgetWithIncome)}
        remainingBudget={remainingBudgetData}
        onColorChange={handleColorChange}
      />
    {:else}
      <div class="bg-surface-dark rounded-xl p-8 flex flex-col items-center justify-center border border-border-dark min-h-[300px]">
        <span class="material-symbols-outlined text-5xl text-text-muted mb-4">pie_chart</span>
        <h3 class="text-lg font-semibold text-white mb-2">No budget set yet</h3>
        <p class="text-text-muted text-center max-w-sm">
          Go to Budget page or use AI Coach to set up your monthly budget
        </p>
        <a
          href="/budget"
          class="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary-hover transition-colors"
        >
          <span class="material-symbols-outlined">add</span>
          Set Up Budget
        </a>
      </div>
    {/if}
  </div>

  <!-- Recent Expenses (1 column) -->
  <div class="lg:col-span-1">
    {#if recentExpenses.length > 0}
      <RecentExpenses expenses={recentExpenses} currency={currencies[selectedCurrency].symbol} />
    {:else}
      <div class="bg-surface-dark rounded-xl p-8 flex flex-col items-center justify-center border border-border-dark min-h-[300px]">
        <span class="material-symbols-outlined text-5xl text-text-muted mb-4">receipt_long</span>
        <h3 class="text-lg font-semibold text-white mb-2">No transactions yet</h3>
        <p class="text-text-muted text-center">
          Add transactions to track spending
        </p>
      </div>
    {/if}
  </div>
</section>
