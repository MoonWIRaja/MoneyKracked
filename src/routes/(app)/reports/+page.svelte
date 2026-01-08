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
  let loading = $state(true);
  
  // Month/Year selector (like Budget page)
  const currentDate = new Date();
  let selectedMonth = $state(currentDate.getMonth()); // 0-11
  let selectedYear = $state(currentDate.getFullYear());
  
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  const years = Array.from({ length: 4 }, (_, i) => currentDate.getFullYear() - 2 + i);
  
  const selectedMonthYear = $derived(`${months[selectedMonth]} ${selectedYear}`);
  
  // Data from APIs
  interface Budget {
    categoryName: string;
    categoryColor: string;
    limitAmount: number;
    spent: number;
  }
  
  interface Transaction {
    id: string;
    amount: number;
    type: 'income' | 'expense';
    date: string;
    categoryName: string;
    categoryColor: string;
    payee: string;
  }
  
  let budgets = $state<Budget[]>([]);
  let transactions = $state<Transaction[]>([]);
  
  // Computed values
  const totalBudget = $derived(budgets.reduce((sum, b) => sum + b.limitAmount, 0));
  const incomeTotal = $derived(transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0));
  const totalBudgetWithIncome = $derived(totalBudget + incomeTotal);
  
  // Spending by category (matches budget page calculation)
  const spendingByCategory = $derived(() => {
    const expenses = transactions.filter(t => t.type === 'expense');
    const categoryTotals: Record<string, { name: string; amount: number; color: string }> = {};

    for (const t of expenses) {
      // Match budget page logic: 'Uncategorized' and empty become 'Other'
      let catName = t.categoryName || 'Other';
      if (catName === 'Uncategorized') catName = 'Other';

      if (!categoryTotals[catName]) {
        categoryTotals[catName] = { name: catName, amount: 0, color: t.categoryColor || '#6b7280' };
      }
      categoryTotals[catName].amount += t.amount;
    }

    return Object.values(categoryTotals).sort((a, b) => b.amount - a.amount);
  });
  
  // Expenses excluding Savings category
  const totalExpenses = $derived(
    spendingByCategory().filter(c => c.name !== 'Savings').reduce((sum, c) => sum + c.amount, 0)
  );

  // Savings category amount
  const savingsCategoryAmount = $derived(
    spendingByCategory().find(c => c.name === 'Savings')?.amount || 0
  );

  // Remaining Budget = Total (budgets + income) - all expenses (including Savings)
  const allExpenses = $derived(spendingByCategory().reduce((sum, c) => sum + c.amount, 0));
  const remainingBudget = $derived(totalBudgetWithIncome - allExpenses);

  // Total Savings = Remaining Budget + Savings Category
  const totalSavings = $derived(remainingBudget + savingsCategoryAmount);
  
  // Top 5 spending categories (excluding Savings)
  const topCategories = $derived(() => {
    const cats = spendingByCategory().filter(c => c.name !== 'Savings').slice(0, 5);
    const maxAmount = cats.length > 0 ? cats[0].amount : 1;
    return cats.map(c => ({
      ...c,
      percentage: (c.amount / maxAmount) * 100
    }));
  });
  
  // Monthly chart data (last 6 months for Savings vs Expenses)
  // Note: This chart shows data for the selected month/year only, not historical
  const monthlyData = $derived(() => {
    // For current selected month, calculate:
    // - Savings = Remaining Budget + Savings category amount
    // - Expenses = All expenses except Savings category
    const monthExpenses = spendingByCategory().filter(c => c.name !== 'Savings');
    const totalExpensesAmount = monthExpenses.reduce((sum, c) => sum + c.amount, 0);
    const savingsAmount = savingsCategoryAmount;

    // Return single data point for selected month
    return [{
      month: months[selectedMonth].substring(0, 3),
      savings: totalSavings, // Remaining + Savings category
      expenses: totalExpensesAmount
    }];
  });
  
  const maxChartValue = $derived(
    monthlyData().length > 0 
      ? Math.max(...monthlyData().flatMap(d => [d.savings, d.expenses])) 
      : 1
  );
  
  function getBarHeight(value: number): number {
    return maxChartValue > 0 ? (value / maxChartValue) * 100 : 0;
  }
  
  onMount(async () => {
    await fetchPreferences();
    await fetchData();
  });
  
  // Re-fetch when month/year changes
  $effect(() => {
    const _ = selectedMonth + selectedYear;
    fetchData();
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
  
  async function fetchData() {
    loading = true;
    try {
      const month = selectedMonth + 1;
      const year = selectedYear;
      
      // Fetch budgets
      const budgetResponse = await fetch(`/api/budgets?month=${month}&year=${year}`, {
        credentials: 'include'
      });
      const budgetData = await budgetResponse.json();
      if (budgetData.budgets) {
        budgets = budgetData.budgets;
      }
      
      // Fetch transactions for the month
      const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
      const endDate = new Date(year, month, 0).toISOString().split('T')[0];
      const txResponse = await fetch(`/api/transactions?startDate=${startDate}&endDate=${endDate}`, {
        credentials: 'include'
      });
      const txData = await txResponse.json();
      if (txData.transactions) {
        transactions = txData.transactions;
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      loading = false;
    }
  }
  
  function formatAmount(amount: number): string {
    const curr = currencies[selectedCurrency];
    return curr.symbol + ' ' + new Intl.NumberFormat(curr.locale).format(amount);
  }

  // Export CSV - Proper CSV format with BOM for Excel compatibility
  function exportCSV() {
    try {
      const curr = currencies[selectedCurrency];
      const now = new Date();

      // Helper function to format amount
      function fmt(amt: number): string {
        return curr.symbol + ' ' + new Intl.NumberFormat(curr.locale).format(amt);
      }

      // Helper to escape CSV values
      function escapeCsv(val: string): string {
        // If value contains comma, quote, or newline, wrap in quotes and escape quotes
        if (val.includes(',') || val.includes('"') || val.includes('\n')) {
          return '"' + val.replace(/"/g, '""') + '"';
        }
        return val;
      }

      let csv = '';

      // Add BOM for Excel to recognize UTF-8
      csv = '\uFEFF';

      // Header
      csv += 'Budget Report,' + selectedMonthYear + '\n';
      csv += 'Generated,' + now.toLocaleDateString() + '\n\n';

      // Summary Section
      csv += '===== SUMMARY =====\n';
      csv += 'Metric,Amount\n';
      csv += 'Total Budget + Income,' + fmt(totalBudgetWithIncome) + '\n';
      csv += 'Total Spent,' + fmt(totalExpenses) + '\n';
      csv += 'Total Savings,' + fmt(totalSavings) + '\n';
      csv += 'Remaining,' + fmt(remainingBudget) + '\n\n';

      // Budget vs Actual
      if (budgets.length > 0) {
        csv += '===== BUDGET VS ACTUAL SPENDING =====\n';
        csv += 'Category,Budget,Spent,Remaining,Progress %\n';
        for (const b of budgets) {
          const cats = spendingByCategory();
          const spent = cats.find(c => c.name === b.categoryName)?.amount || 0;
          const rem = b.limitAmount - spent;
          const pct = b.limitAmount > 0 ? Math.round((spent / b.limitAmount) * 100) : 0;
          csv += escapeCsv(b.categoryName) + ',' +
                  fmt(b.limitAmount) + ',' +
                  fmt(spent) + ',' +
                  fmt(rem) + ',' +
                  pct + '%\n';
        }
        csv += '\n';
      }

      // Spending by Category
      const cats = spendingByCategory().filter(c => c.name !== 'Income');
      if (cats.length > 0) {
        const total = cats.reduce((s, c) => s + c.amount, 0);
        csv += '===== SPENDING BY CATEGORY =====\n';
        csv += 'Category,Amount,Percentage %\n';
        for (const cat of cats) {
          const pct = total > 0 ? ((cat.amount / total) * 100).toFixed(1) : '0.0';
          csv += escapeCsv(cat.name) + ',' + fmt(cat.amount) + ',' + pct + '%\n';
        }
        csv += '\n';
      }

      // Transaction History
      const sorted = [...transactions].sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      csv += '===== TRANSACTION HISTORY =====\n';
      csv += 'Date,Type,Category,Payee,Amount\n';
      for (const t of sorted) {
        const d = new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
        const typ = (t.type || 'EXPENSE').toUpperCase();
        const cat = t.categoryName || 'Other';
        const py = t.payee || 'No description';
        const amt = (t.type === 'income' ? '+' : '-') + ' ' + fmt(t.amount);
        csv += d + ',' +
                escapeCsv(typ) + ',' +
                escapeCsv(cat) + ',' +
                escapeCsv(py) + ',' +
                escapeCsv(amt) + '\n';
      }

      csv += '\n===== Generated by MoneyKracked =====\n';

      // Create download
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `MoneyKracked_Report_${months[selectedMonth]}_${selectedYear}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (err) {
      console.error('Export CSV error:', err);
      alert('Failed to export report. Please try again.');
    }
  }

  // Generate Pie Chart SVG
  function generatePieChart(data: Array<{ label: string; amount: number; color: string }>, total: number): string {
    if (total === 0) return '';

    let startAngle = 0;
    const slices = data.map(d => {
      if (d.amount === 0) return '';
      const percentage = (d.amount / total) * 100;
      const angle = (d.amount / total) * 360;
      const endAngle = startAngle + angle;

      const x1 = 50 + 40 * Math.cos((Math.PI / 180) * startAngle);
      const y1 = 50 + 40 * Math.sin((Math.PI / 180) * startAngle);
      const x2 = 50 + 40 * Math.cos((Math.PI / 180) * endAngle);
      const y2 = 50 + 40 * Math.sin((Math.PI / 180) * endAngle);

      const largeArc = angle > 180 ? 1 : 0;
      const pathData = `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`;

      startAngle = endAngle;
      return `<path d="${pathData}" fill="${d.color}" stroke="#fff" stroke-width="1"/>`;
    }).join('');

    return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${slices}</svg>`;
  }

  // Generate Bar Chart HTML
  function generateBarChart(title: string, data: Array<{ label: string; value: number; color: string }>, maxValue: number): string {
    if (data.length === 0 || maxValue === 0) return '';

    const bars = data.map(d => {
      const width = (d.value / maxValue) * 100;
      return `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${d.label}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">
            <div style="background: #f3f4f6; border-radius: 4px; overflow: hidden; width: 100%;">
              <div style="background: ${d.color}; width: ${width}%; height: 20px; border-radius: 4px;"></div>
            </div>
          </td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 500;">${formatAmount(d.value)}</td>
        </tr>
      `;
    }).join('');

    return `
      <table style="width: 100%; border-collapse: collapse; margin-top: 12px;">
        <thead>
          <tr style="background: #f9fafb;">
            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #d1d5db;">Category</th>
            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #d1d5db;">Progress</th>
            <th style="padding: 10px; text-align: right; border-bottom: 2px solid #d1d5db;">Amount</th>
          </tr>
        </thead>
        <tbody>${bars}</tbody>
      </table>
    `;
  }

  // Export HTML Report
  function exportReport() {
    const now = new Date();
    const fileName = `MoneyKracked_Report_${months[selectedMonth]}_${selectedYear}.html`;

    // Prepare chart data
    const pieChartData = spendingByCategory().slice(0, 8).map(c => ({
      label: c.name,
      value: c.amount,
      amount: c.amount,
      color: c.color
    }));
    const pieTotal = pieChartData.reduce((sum, c) => sum + c.amount, 0);
    const pieChartSVG = generatePieChart(pieChartData, pieTotal);

    // Budget comparison data
    const budgetData = budgets.map(b => {
      const spent = spendingByCategory().find(c => c.name === b.categoryName)?.amount || 0;
      const percentage = b.limitAmount > 0 ? (spent / b.limitAmount) * 100 : 0;
      let color = '#10b981'; // green
      if (percentage >= 100) color = '#ef4444'; // red
      else if (percentage >= 80) color = '#f59e0b'; // orange

      return {
        label: b.categoryName,
        value: spent,
        max: b.limitAmount,
        percentage: percentage,
        color: color
      };
    }).filter(b => b.max > 0);

    // Spending by category chart
    const spendingChartData = spendingByCategory()
      .filter(c => c.name !== 'Income')
      .map(c => ({
        label: c.name,
        value: c.amount,
        color: c.color
      }));

    const maxSpending = Math.max(...spendingChartData.map(c => c.value), 1);

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Budget Report - ${selectedMonthYear}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
      min-height: 100vh;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
      background: white;
      border-radius: 16px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 32px;
      text-align: center;
    }
    .header h1 {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .header p {
      opacity: 0.9;
      font-size: 14px;
    }
    .content { padding: 32px; }
    .section {
      background: #f9fafb;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
      border: 1px solid #e5e7eb;
    }
    .section-title {
      font-size: 18px;
      font-weight: 700;
      color: #1f2937;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .section-title::before {
      content: '';
      width: 4px;
      height: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 2px;
    }
    .summary-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px;
    }
    .card {
      background: white;
      padding: 20px;
      border-radius: 12px;
      border: 1px solid #e5e7eb;
      text-align: center;
    }
    .card-label {
      font-size: 13px;
      color: #6b7280;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .card-value {
      font-size: 28px;
      font-weight: 800;
      color: #1f2937;
    }
    .card-value.positive { color: #10b981; }
    .card-value.negative { color: #ef4444; }
    .card-subtitle {
      font-size: 12px;
      color: #9ca3af;
      margin-top: 4px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 16px;
    }
    th {
      background: #f3f4f6;
      padding: 12px;
      text-align: left;
      font-weight: 600;
      color: #374151;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 2px solid #e5e7eb;
    }
    td {
      padding: 12px;
      border-bottom: 1px solid #e5e7eb;
      color: #4b5563;
    }
    tr:last-child td { border-bottom: none; }
    .amount {
      font-family: 'Courier New', monospace;
      font-weight: 600;
      text-align: right;
    }
    .income { color: #10b981; }
    .expense { color: #ef4444; }
    .chart-container {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 32px;
      flex-wrap: wrap;
    }
    .pie-chart {
      width: 200px;
      height: 200px;
    }
    .legend {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      color: #4b5563;
    }
    .legend-color {
      width: 16px;
      height: 16px;
      border-radius: 4px;
    }
    .progress-bar {
      background: #e5e7eb;
      border-radius: 8px;
      overflow: hidden;
      height: 24px;
    }
    .progress-fill {
      height: 100%;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 600;
      color: white;
      transition: width 0.3s ease;
    }
    .footer {
      text-align: center;
      padding: 24px;
      color: #6b7280;
      font-size: 13px;
      border-top: 1px solid #e5e7eb;
      background: #f9fafb;
    }
    @media print {
      body { background: white; padding: 0; }
      .container { box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>💰 Budget Report</h1>
      <p>${selectedMonthYear} • Generated on ${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
    </div>

    <div class="content">
      <!-- Summary Cards -->
      <div class="section">
        <div class="section-title">Summary Overview</div>
        <div class="summary-cards">
          <div class="card">
            <div class="card-label">Total Budget + Income</div>
            <div class="card-value">${formatAmount(totalBudgetWithIncome)}</div>
            <div class="card-subtitle">Available for the month</div>
          </div>
          <div class="card">
            <div class="card-label">Total Spent</div>
            <div class="card-value">${formatAmount(totalExpenses)}</div>
            <div class="card-subtitle">All expenses</div>
          </div>
          <div class="card">
            <div class="card-label">Total Savings</div>
            <div class="card-value positive">${formatAmount(totalSavings)}</div>
            <div class="card-subtitle">Remaining + Savings</div>
          </div>
          <div class="card">
            <div class="card-label">Remaining</div>
            <div class="card-value ${remainingBudget >= 0 ? 'positive' : 'negative'}">${formatAmount(remainingBudget)}</div>
            <div class="card-subtitle">Budget left</div>
          </div>
        </div>
      </div>

      <!-- Budget vs Spent -->
      <div class="section">
        <div class="section-title">Budget vs Actual Spending</div>
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th>Budget</th>
              <th>Spent</th>
              <th>Remaining</th>
              <th>Progress</th>
            </tr>
          </thead>
          <tbody>
            ${budgetData.map(b => `
              <tr>
                <td>${b.label}</td>
                <td class="amount">${formatAmount(b.max)}</td>
                <td class="amount">${formatAmount(b.value)}</td>
                <td class="amount ${b.max - b.value >= 0 ? 'positive' : 'negative'}">${formatAmount(b.max - b.value)}</td>
                <td style="width: 30%;">
                  <div class="progress-bar">
                    <div class="progress-fill" style="width: ${Math.min(b.percentage, 100)}%; background: ${b.color};">
                      ${b.percentage.toFixed(1)}%
                    </div>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Spending by Category Pie Chart -->
      ${pieChartData.length > 0 ? `
      <div class="section">
        <div class="section-title">Spending Distribution</div>
        <div class="chart-container">
          <div class="pie-chart">${pieChartSVG}</div>
          <div class="legend">
            ${pieChartData.map(d => `
              <div class="legend-item">
                <div class="legend-color" style="background: ${d.color};"></div>
                <span>${d.label}: ${formatAmount(d.value)} (${((d.amount / pieTotal) * 100).toFixed(1)}%)</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
      ` : ''}

      <!-- Top Spending Categories -->
      <div class="section">
        <div class="section-title">Spending by Category</div>
        ${generateBarChart('Spending', spendingChartData, maxSpending)}
      </div>

      <!-- Transactions List -->
      <div class="section">
        <div class="section-title">Transaction History</div>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Payee</th>
              <th>Category</th>
              <th style="text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${transactions
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .map(t => `
              <tr>
                <td>${new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                <td>${t.payee || t.categoryName}</td>
                <td><span style="display: inline-block; padding: 2px 8px; background: ${t.categoryColor}20; color: ${t.categoryColor}; border-radius: 4px; font-size: 12px;">${t.categoryName}</span></td>
                <td class="amount ${t.type === 'income' ? 'income' : 'expense'}">${t.type === 'income' ? '+' : '-'}${formatAmount(t.amount)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="footer">
      <p>Generated by MoneyKracked • ${now.toLocaleString()}</p>
      <p style="margin-top: 4px; font-size: 11px;">This report was generated automatically based on your tracked transactions and budgets.</p>
    </div>
  </div>
</body>
</html>`;

    // Download
    const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }
</script>

<svelte:head>
  <title>Reports - MoneyKracked</title>
</svelte:head>

<!-- Page Header with Month Selector -->
<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
  <div>
    <h2 class="text-3xl font-black tracking-tight text-white">Reports</h2>
    <p class="mt-1 text-base text-text-secondary">Financial summary for {selectedMonthYear}</p>
  </div>
  
  <div class="flex items-center gap-2">
    <!-- Month/Year Selector -->
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

    <!-- Export Dropdown -->
    <div class="relative">
      <button
        onclick={() => { const el = document.getElementById('export-menu'); el?.classList.toggle('hidden'); }}
        class="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary-hover transition-colors"
      >
        <span class="material-symbols-outlined text-lg">download</span>
        Export
        <span class="material-symbols-outlined text-sm">expand_more</span>
      </button>
      <div id="export-menu" class="hidden absolute right-0 mt-2 w-48 bg-surface-dark border border-border-dark rounded-lg shadow-xl z-10">
        <button
          onclick={() => { document.getElementById('export-menu')?.classList.add('hidden'); exportCSV(); }}
          class="w-full px-4 py-3 text-left text-white hover:bg-border-dark transition-colors flex items-center gap-2 rounded-t-lg"
        >
          <span class="material-symbols-outlined text-lg">table_chart</span>
          Export CSV
        </button>
        <button
          onclick={() => { document.getElementById('export-menu')?.classList.add('hidden'); exportReport(); }}
          class="w-full px-4 py-3 text-left text-white hover:bg-border-dark transition-colors flex items-center gap-2 rounded-b-lg"
        >
          <span class="material-symbols-outlined text-lg">description</span>
          Export HTML Report
        </button>
      </div>
    </div>
  </div>
</div>

<!-- Summary Cards -->
<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
  <Card>
    <div class="flex items-center gap-3">
      <div class="p-2 rounded-lg bg-primary/20">
        <span class="material-symbols-outlined text-primary">account_balance</span>
      </div>
      <div>
        <p class="text-sm font-medium text-text-secondary">Total Budget</p>
        <h3 class="text-xl font-bold text-white">
          {loading ? '...' : formatAmount(totalBudgetWithIncome)}
        </h3>
      </div>
    </div>
  </Card>
  
  <Card>
    <div class="flex items-center gap-3">
      <div class="p-2 rounded-lg bg-warning/20">
        <span class="material-symbols-outlined text-warning">shopping_cart</span>
      </div>
      <div>
        <p class="text-sm font-medium text-text-secondary">Total Spent</p>
        <h3 class="text-xl font-bold text-white">
          {loading ? '...' : formatAmount(totalExpenses)}
        </h3>
      </div>
    </div>
  </Card>
  
  <Card>
    <div class="flex items-center gap-3">
      <div class="p-2 rounded-lg bg-blue-500/20">
        <span class="material-symbols-outlined text-blue-400">savings</span>
      </div>
      <div>
        <p class="text-sm font-medium text-text-secondary">Savings</p>
        <h3 class="text-xl font-bold text-white">
          {loading ? '...' : formatAmount(totalSavings)}
        </h3>
      </div>
    </div>
  </Card>
  
  <Card>
    <div class="flex items-center gap-3">
      <div class="p-2 rounded-lg {remainingBudget >= 0 ? 'bg-primary/20' : 'bg-danger/20'}">
        <span class="material-symbols-outlined {remainingBudget >= 0 ? 'text-primary' : 'text-danger'}">wallet</span>
      </div>
      <div>
        <p class="text-sm font-medium text-text-secondary">Remaining</p>
        <h3 class="text-xl font-bold {remainingBudget >= 0 ? 'text-primary' : 'text-danger'}">
          {loading ? '...' : formatAmount(remainingBudget)}
        </h3>
      </div>
    </div>
  </Card>
</div>

<!-- Charts Grid -->
<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
  <!-- Savings vs Expenses Chart -->
  <Card padding="lg">
    <h3 class="text-lg font-bold text-white mb-6">Savings vs Expenses</h3>
    
    {#if loading}
      <div class="h-48 flex items-center justify-center">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
      </div>
    {:else if monthlyData().some(d => d.savings > 0 || d.expenses > 0)}
      <div class="flex items-end gap-4 h-48">
        {#each monthlyData() as data}
          <div class="flex-1 flex flex-col items-center gap-2">
            <div class="w-full flex gap-1 items-end h-40">
              <div 
                class="flex-1 bg-blue-500 rounded-t transition-all duration-500"
                style="height: {getBarHeight(data.savings)}%"
                title="Savings: {formatAmount(data.savings)}"
              ></div>
              <div 
                class="flex-1 bg-warning rounded-t transition-all duration-500"
                style="height: {getBarHeight(data.expenses)}%"
                title="Expenses: {formatAmount(data.expenses)}"
              ></div>
            </div>
            <span class="text-xs text-text-muted">{data.month}</span>
          </div>
        {/each}
      </div>
      
      <!-- Legend -->
      <div class="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-border-dark">
        <div class="flex items-center gap-2">
          <div class="w-3 h-3 rounded-full bg-blue-500"></div>
          <span class="text-sm text-text-secondary">Savings</span>
        </div>
        <div class="flex items-center gap-2">
          <div class="w-3 h-3 rounded-full bg-warning"></div>
          <span class="text-sm text-text-secondary">Expenses</span>
        </div>
      </div>
    {:else}
      <div class="h-48 flex flex-col items-center justify-center text-text-muted">
        <span class="material-symbols-outlined text-4xl mb-2">bar_chart</span>
        <p>No transaction data for {selectedMonthYear}</p>
        <p class="text-xs mt-1">Add transactions to see your trends</p>
      </div>
    {/if}
  </Card>
  
  <!-- Top Spending Categories -->
  <Card padding="lg">
    <h3 class="text-lg font-bold text-white mb-6">Top Spending Categories</h3>
    
    {#if loading}
      <div class="h-48 flex items-center justify-center">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
      </div>
    {:else if topCategories().length > 0}
      <div class="space-y-4">
        {#each topCategories() as category, i}
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <span 
                  class="w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold"
                  style="background-color: {category.color}30; color: {category.color}"
                >
                  {i + 1}
                </span>
                <span class="font-medium text-white">{category.name}</span>
              </div>
              <span class="font-bold text-white">{formatAmount(category.amount)}</span>
            </div>
            <div class="h-2 rounded-full bg-border-dark overflow-hidden">
              <div 
                class="h-full rounded-full transition-all duration-500"
                style="width: {category.percentage}%; background-color: {category.color}"
              ></div>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <div class="h-48 flex flex-col items-center justify-center text-text-muted">
        <span class="material-symbols-outlined text-4xl mb-2">pie_chart</span>
        <p>No spending data for {selectedMonthYear}</p>
        <p class="text-xs mt-1">Add expense transactions to see breakdown</p>
      </div>
    {/if}
  </Card>
</div>
