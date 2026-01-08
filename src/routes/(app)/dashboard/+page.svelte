<script lang="ts">
  import { Header } from '$lib/components/layout';
  import { KPICard, SpendingChart, RecentExpenses } from '$lib/components/dashboard';
  import { onMount } from 'svelte';
  
  // Currency settings
  const currencies: Record<string, { symbol: string; locale: string }> = {
    'MYR': { symbol: 'RM', locale: 'en-MY' },
    'SGD': { symbol: 'S$', locale: 'en-SG' },
    'USD': { symbol: '$', locale: 'en-US' }
  };
  
  let selectedCurrency = $state('MYR');
  
  // Budget data from API
  interface Budget {
    id: string;
    categoryName: string;
    categoryIcon: string;
    categoryColor: string;
    limitAmount: number;
    spent: number;
  }
  
  let budgets = $state<Budget[]>([]);
  let loading = $state(true);

  // Spending chart data
  let spendingData: Array<{ name: string; value: number; percentage: number; color: string; formattedValue: string }> = $state([]);
  let remainingBudgetData = $state<{ value: number; formattedValue: string; percentage: number } | undefined>(undefined);
  let totalBudgetWithIncome = $state(0); // Total including income for chart display
  let recentExpenses: Array<{
    id: string;
    payee: string;
    amount: number;
    date: string;
    icon: string;
    iconColor: string;
    iconBg: string;
  }> = $state([]);

  // Computed values from budgets
  const totalBudget = $derived(budgets.reduce((sum, b) => sum + b.limitAmount, 0));
  const totalSpent = $derived(budgets.reduce((sum, b) => sum + b.spent, 0));
  const remainingBudget = $derived(totalBudget - totalSpent);
  const overspentCategories = $derived(budgets.filter(b => b.spent > b.limitAmount).length);
  
  // Fetch preferences and budget data on mount
  onMount(async () => {
    await fetchPreferences();
    await fetchBudgetData();
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
  
  async function fetchBudgetData() {
    loading = true;
    try {
      // Get current month/year
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();
      
      // Fetch budgets
      const budgetResponse = await fetch(`/api/budgets?month=${month}&year=${year}`, {
        credentials: 'include'
      });
      const budgetData = await budgetResponse.json();
      
      // Fetch transactions for this month
      const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
      const endDate = new Date(year, month, 0).toISOString().split('T')[0];
      const txResponse = await fetch(`/api/transactions?startDate=${startDate}&endDate=${endDate}`, {
        credentials: 'include'
      });
      const txData = await txResponse.json();
      
      // Calculate income total and spending by category
      let incomeTotal = 0;
      const spentByCategory: Record<string, number> = {};

      if (txData.transactions) {
        for (const tx of txData.transactions) {
          if (tx.type === 'income') {
            incomeTotal += tx.amount;
          } else if (tx.type === 'expense') {
            const catName = tx.categoryName || 'Other';
            spentByCategory[catName] = (spentByCategory[catName] || 0) + tx.amount;
          }
        }
      }

      if (budgetData.budgets) {
        budgets = budgetData.budgets.map((b: any) => ({
          ...b,
          spent: spentByCategory[b.categoryName] || 0
        }));
      }

      // Total budget = budget limits + income
      const budgetLimits = budgets.reduce((sum, b) => sum + b.limitAmount, 0);
      const calculatedTotalWithIncome = budgetLimits + incomeTotal;
      // Include all spending from spentByCategory (including unbudgeted like 'Other')
      const totalSpentAmount = Object.values(spentByCategory).reduce((sum, amount) => sum + amount, 0);
      const totalRemainingAmount = calculatedTotalWithIncome - totalSpentAmount;

      // Build chart data - show all budgeted categories with their spent amount
      const curr = currencies[selectedCurrency];
      spendingData = [];

      // Add all budgeted categories with their spent amount (include even if spent is 0)
      for (const b of budgets) {
        // Skip 'Income' from expense chart - it's handled separately
        if (b.categoryName === 'Income') continue;

        spendingData.push({
          name: b.categoryName,
          value: b.spent,
          percentage: calculatedTotalWithIncome > 0 ? (b.spent / calculatedTotalWithIncome) * 100 : 0,
          color: b.categoryColor,
          formattedValue: curr.symbol + ' ' + new Intl.NumberFormat(curr.locale).format(b.spent)
        });
      }

      // Add 'Other' category if not in budgets (it's a default category that always exists)
      const hasOtherBudget = budgets.some(b => b.categoryName === 'Other');
      const otherSpent = spentByCategory['Other'] || 0;
      if (!hasOtherBudget) {
        spendingData.push({
          name: 'Other',
          value: otherSpent,
          percentage: calculatedTotalWithIncome > 0 ? (otherSpent / calculatedTotalWithIncome) * 100 : 0,
          color: '#6b7280',
          formattedValue: curr.symbol + ' ' + new Intl.NumberFormat(curr.locale).format(otherSpent)
        });
      }

      // Add 'Income' category if not in budgets (it's a default category that always exists)
      const hasIncomeBudget = budgets.some(b => b.categoryName === 'Income');
      if (!hasIncomeBudget) {
        spendingData.push({
          name: 'Income',
          value: incomeTotal,
          percentage: calculatedTotalWithIncome > 0 ? (incomeTotal / calculatedTotalWithIncome) * 100 : 0,
          color: '#10b981',
          formattedValue: curr.symbol + ' ' + new Intl.NumberFormat(curr.locale).format(incomeTotal)
        });
      }

      // Add other unbudgeted spending (categories with spending but no budget)
      for (const [catName, amount] of Object.entries(spentByCategory)) {
        const hasBudget = budgets.some(b => b.categoryName === catName);
        if (!hasBudget && catName !== 'Other' && catName !== 'Income' && amount > 0) {
          spendingData.push({
            name: catName,
            value: amount,
            percentage: calculatedTotalWithIncome > 0 ? (amount / calculatedTotalWithIncome) * 100 : 0,
            color: '#6b7280', // Default gray for unbudgeted categories
            formattedValue: curr.symbol + ' ' + new Intl.NumberFormat(curr.locale).format(amount)
          });
        }
      }

      // Populate recent expenses from transactions (limit to 5 most recent)
      if (txData.transactions) {
        recentExpenses = txData.transactions
          .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 5)
          .map((tx: any) => {
            // Get category info
            const category = budgets.find(b => b.categoryName === tx.categoryName);
            const icon = tx.categoryIcon || category?.categoryIcon || 'receipt';
            const color = tx.categoryColor || category?.categoryColor || '#6b7280';

            // Generate Tailwind classes from color
            // Since we can't use arbitrary values dynamically, use a mapping
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
              '#14b8a6': { bg: 'bg-teal-500/20', text: 'text-teal-500' }
            };

            const colorClasses = colorClassMap[color.toLowerCase()] || { bg: 'bg-gray-500/20', text: 'text-gray-500' };

            return {
              id: tx.id,
              payee: tx.payee || 'No description',
              amount: tx.amount,
              date: tx.date,
              icon: icon,
              iconColor: colorClasses.text,
              iconBg: colorClasses.bg
            };
          });
      }

      // Sort by value (descending) - but keep zero-value budgets at the end
      spendingData.sort((a, b) => {
        if (a.value === 0 && b.value === 0) return a.name.localeCompare(b.name);
        if (a.value === 0) return 1;
        if (b.value === 0) return -1;
        return b.value - a.value;
      });

      // Store total with income for chart display
      totalBudgetWithIncome = calculatedTotalWithIncome;

      remainingBudgetData = {
        value: totalRemainingAmount,
        formattedValue: curr.symbol + ' ' + new Intl.NumberFormat(curr.locale).format(totalRemainingAmount),
        percentage: calculatedTotalWithIncome > 0 ? (totalRemainingAmount / calculatedTotalWithIncome) * 100 : 100
      };
    } catch (err) {
      console.error('Failed to load budget data:', err);
    } finally {
      loading = false;
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
        // Update local data immediately
        spendingData = spendingData.map(item => 
          item.name === categoryName ? { ...item, color } : item
        );
        console.log(`Color updated for ${categoryName}: ${color}`);
      }
    } catch (err) {
      console.error('Failed to update color:', err);
    }
  }
  
  function formatAmount(amount: number): string {
    if (amount === 0 && totalBudget === 0) return '-';
    const curr = currencies[selectedCurrency];
    return curr.symbol + ' ' + new Intl.NumberFormat(curr.locale).format(amount);
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
    value={formatAmount(totalBudget)}
    icon="savings"
    iconColor="blue"
  />
  
  <KPICard
    title="Remaining Budget"
    value={formatAmount(remainingBudget)}
    valueColor={remainingBudget >= 0 ? 'primary' : 'danger'}
    icon="account_balance"
    iconColor={remainingBudget >= 0 ? 'green' : 'red'}
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
