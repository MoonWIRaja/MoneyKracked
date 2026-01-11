<script lang="ts">
  import { IsometricCard, PixelButton } from '$lib/components/ui';
  import { onMount, onDestroy } from 'svelte';
  import { type Currency } from '$lib/utils/currency';
  import { getExchangeRates, getUserPreferences, getCachedRatesSync, getCachedPreferencesSync, toggleSidebar } from '$lib/stores/app-store.svelte';
  import { subscribeToCurrency, convertAmountMYR, convertToMYR as convertToMYRStore } from '$lib/stores/currency-store';

  // Currency settings
  const currencies: Record<string, { symbol: string; locale: string }> = {
    'MYR': { symbol: 'RM', locale: 'en-MY' },
    'SGD': { symbol: 'S$', locale: 'en-SG' },
    'USD': { symbol: '$', locale: 'en-US' }
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
  // NON-REACTIVE CURRENCY STATE - avoids reactive cycles
  // Reactive trigger counter forces template re-render on currency change
  // ============================================================
  let selectedCurrency: Currency = (getCachedPreferencesSync()?.currency as Currency) || 'MYR';
  let exchangeRates: Record<string, Record<string, number>> = getCachedRatesSync() || {};
  let currencyUpdateCounter = $state(0);  // Reactive trigger
  
  let loading = $state(true);
  
  const currentDate = new Date();
  let selectedMonth = $state(currentDate.getMonth());
  let selectedYear = $state(currentDate.getFullYear());
  
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  const years = Array.from({ length: 4 }, (_, i) => currentDate.getFullYear() - 2 + i);
  const selectedMonthYear = $derived(`${months[selectedMonth]} ${selectedYear}`);
  
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

  // Computed values - correctly using $derived for reactivity in Svelte 5
  const totalBudget = $derived(budgets.reduce((sum, b) => sum + b.limitAmount, 0));
  const incomeTotal = $derived(transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0));
  const totalBudgetWithIncome = $derived(totalBudget + incomeTotal);
  
  const spendingByCategory = $derived.by(() => {
    const expenses = transactions.filter(t => t.type === 'expense');
    const categoryTotals: Record<string, { name: string; amount: number; color: string }> = {};

    for (const t of expenses) {
      let catName = t.categoryName || 'Other';
      if (catName === 'Uncategorized') catName = 'Other';

      if (!categoryTotals[catName]) {
        categoryTotals[catName] = { name: catName, amount: 0, color: t.categoryColor || '#6b7280' };
      }
      categoryTotals[catName].amount += t.amount;
    }

    return Object.values(categoryTotals).sort((a, b) => b.amount - a.amount);
  });

  const totalExpenses = $derived(
    spendingByCategory.filter(c => c.name !== 'Savings').reduce((sum, c) => sum + c.amount, 0)
  );

  const savingsCategoryAmount = $derived(
    spendingByCategory.find(c => c.name === 'Savings')?.amount || 0
  );

  const allExpenses = $derived(spendingByCategory.reduce((sum, c) => sum + (c.amount || 0), 0));
  const remainingBudget = $derived(totalBudgetWithIncome - allExpenses);
  const totalSavings = $derived(remainingBudget + savingsCategoryAmount);

  const monthlyData = $derived.by(() => {
    const monthExpenses = spendingByCategory.filter(c => c.name !== 'Savings');
    const totalExpensesAmount = monthExpenses.reduce((sum, c) => sum + c.amount, 0);

    return [{
      month: months[selectedMonth].substring(0, 3),
      savings: totalSavings,
      expenses: totalExpensesAmount
    }];
  });

  const maxChartValue = $derived.by(() =>
    monthlyData.length > 0
      ? Math.max(...monthlyData.flatMap(d => [d.savings, d.expenses]))
      : 1
  );

  $effect(() => {
    const _ = selectedMonth + selectedYear;
    fetchData();
  });

  function convertAmount(amountMYR: number): number {
    return convertAmountMYR(amountMYR, selectedCurrency, exchangeRates);
  }
  
  function getBarHeight(value: number): number {
    return maxChartValue > 0 ? (value / maxChartValue) * 100 : 0;
  }
  
  async function fetchData() {
    loading = true;
    try {
      const month = selectedMonth + 1;
      const year = selectedYear;

      const budgetResponse = await fetch(`/api/budgets?month=${month}&year=${year}`, { credentials: 'include' });
      const budgetData = await budgetResponse.json();
      if (budgetData.budgets) {
        budgets = budgetData.budgets.map((b: any) => ({
          ...b,
          limitAmount: b.limitAmount, // Keep MYR
          spent: 0
        }));
      }

      const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
      const endDate = new Date(year, month, 0).toISOString().split('T')[0];
      const txResponse = await fetch(`/api/transactions?startDate=${startDate}&endDate=${endDate}`, { credentials: 'include' });
      const txData = await txResponse.json();
      if (txData.transactions) {
        transactions = txData.transactions; // Keep MYR
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      loading = false;
    }
  }

  let unsubscribeCurrency: (() => void) | undefined;

  onMount(async () => {
    // Initial data load already handled by untrack in state or will be updated by subscription
    const [rates, prefs] = await Promise.all([
      getExchangeRates(),
      getUserPreferences()
    ]);

    if (rates) exchangeRates = rates;
    if (prefs?.currency) selectedCurrency = prefs.currency;

    await fetchData();

    unsubscribeCurrency = subscribeToCurrency((currency: Currency, rates: Record<string, Record<string, number>>) => {
      selectedCurrency = currency;
      exchangeRates = rates;
      currencyUpdateCounter++;  // Trigger template re-render
    });
  });

  onDestroy(() => {
    unsubscribeCurrency?.();
  });

  function formatAmount(amountMYR: number): string {
    const convertedAmount = convertAmountMYR(amountMYR, selectedCurrency, exchangeRates);
    const curr = currencies[selectedCurrency] || currencies['MYR'];
    return curr.symbol + ' ' + formatNumber(convertedAmount, curr.locale);
  }

  function exportCSV() {
    try {
        const curr = currencies[selectedCurrency];
        const now = new Date();
  
        function fmt(amt: number): string {
          const conv = convertAmountMYR(amt, selectedCurrency, exchangeRates);
          return curr.symbol + ' ' + formatNumber(conv, curr.locale);
        }
  
        function escapeCsv(val: string): string {
          if (val.includes(',') || val.includes('"') || val.includes('\n')) {
            return '"' + val.replace(/"/g, '""') + '"';
          }
          return val;
        }
  
        let csv = '\uFEFF'; // BOM
        csv += 'Budget Report,' + selectedMonthYear + '\n';
        csv += 'Generated,' + now.toLocaleDateString() + '\n\n';
        
        csv += '===== SUMMARY =====\n';
        csv += 'Metric,Amount\n';
        csv += 'Total Budget + Income,' + fmt(totalBudgetWithIncome) + '\n';
        csv += 'Total Spent,' + fmt(totalExpenses) + '\n';
        csv += 'Total Savings,' + fmt(totalSavings) + '\n';
        csv += 'Remaining,' + fmt(remainingBudget) + '\n\n';
  
        if (budgets.length > 0) {
          csv += '===== BUDGET VS ACTUAL SPENDING =====\n';
          csv += 'Category,Budget,Spent,Remaining,Progress %\n';
          for (const b of budgets) {
            const cats = spendingByCategory;
            const spent = cats.find(c => c.name === b.categoryName)?.amount || 0;
            const rem = b.limitAmount - spent;
            const pct = b.limitAmount > 0 ? Math.round((spent / b.limitAmount) * 100) : 0;
            csv += escapeCsv(b.categoryName) + ',' + fmt(b.limitAmount) + ',' + fmt(spent) + ',' + fmt(rem) + ',' + pct + '%\n';
          }
          csv += '\n';
        }
  
        const cats = spendingByCategory.filter(c => c.name !== 'Income');
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
  
        const sorted = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        csv += '===== TRANSACTION HISTORY =====\n';
        csv += 'Date,Type,Category,Payee,Amount\n';
        for (const t of sorted) {
          const d = new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
          const typ = (t.type || 'EXPENSE').toUpperCase();
          const cat = t.categoryName || 'Other';
          const py = t.payee || 'No description';
          const amt = (t.type === 'income' ? '+' : '-') + ' ' + fmt(t.amount);
          csv += d + ',' + escapeCsv(typ) + ',' + escapeCsv(cat) + ',' + escapeCsv(py) + ',' + escapeCsv(amt) + '\n';
        }
  
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
        alert('Failed to export CSV. Please try again.');
    }
  }

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

  function generateBarChart(title: string, data: Array<{ label: string; value: number; color: string }>, maxValue: number): string { /* Keep logic same, just structure */
     if (data.length === 0 || maxValue === 0) return '';
      const bars = data.map(d => {
        const width = (d.value / maxValue) * 100;
        const conv = convertAmountMYR(d.value, selectedCurrency, exchangeRates);
        const curr = currencies[selectedCurrency];
        const fmtAmt = curr.symbol + ' ' + formatNumber(conv, curr.locale);
        return `
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${d.label}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">
              <div style="background: #f3f4f6; border-radius: 4px; overflow: hidden; width: 100%;">
                <div style="background: ${d.color}; width: ${width}%; height: 20px; border-radius: 4px;"></div>
              </div>
            </td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 500;">${fmtAmt}</td>
          </tr>
        `;
      }).join('');
      return `<table style="width: 100%; border-collapse: collapse; margin-top: 12px;"><thead><tr style="background: #f9fafb;"><th style="padding: 10px; text-align: left; border-bottom: 2px solid #d1d5db;">Category</th><th style="padding: 10px; text-align: left; border-bottom: 2px solid #d1d5db;">Progress</th><th style="padding: 10px; text-align: right; border-bottom: 2px solid #d1d5db;">Amount</th></tr></thead><tbody>${bars}</tbody></table>`;
  }

  function exportReport() {
    try {
        const curr = currencies[selectedCurrency];
        const now = new Date();

        function fmt(amt: number): string {
          const conv = convertAmountMYR(amt, selectedCurrency, exchangeRates);
          return curr.symbol + ' ' + formatNumber(conv, curr.locale);
        }

        const cats = spendingByCategory;
        const topCats = cats.filter((c: any) => c.name !== 'Income' && c.name !== 'Savings').slice(0, 5);
        const maxCat = topCats[0]?.amount || 1;

        // Create print container
        const printContainer = document.createElement('div');
        printContainer.id = 'print-report-container';
        printContainer.innerHTML = `
        <div class="print-header">
            <h1>MoneyKracked</h1>
            <div class="subtitle">FINANCIAL REPORT</div>
            <div class="report-meta">${selectedMonthYear} • Generated ${now.toLocaleDateString()}</div>
        </div>

        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-label">Total Budget</div>
                <div class="stat-value primary">${fmt(totalBudgetWithIncome)}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Total Spent</div>
                <div class="stat-value warning">${fmt(totalExpenses)}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Total Savings</div>
                <div class="stat-value success">${fmt(totalSavings)}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Remaining</div>
                <div class="stat-value ${remainingBudget >= 0 ? 'primary' : 'danger'}">${fmt(remainingBudget)}</div>
            </div>
        </div>

        <div class="section">
            <h2>Budget Performance</h2>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Category</th>
                        <th>Budget</th>
                        <th>Spent</th>
                        <th>Usage</th>
                    </tr>
                </thead>
                <tbody>
                    ${budgets.map(b => {
                        const spent = cats.find((c: any) => c.name === b.categoryName)?.amount || 0;
                        const pct = b.limitAmount > 0 ? Math.min(Math.round((spent / b.limitAmount) * 100), 100) : 0;
                        const status = pct >= 100 ? 'danger' : pct >= 80 ? 'warning' : 'success';
                        return `
                            <tr>
                                <td><span class="cat-dot" style="background: ${b.categoryColor}"></span>${b.categoryName}</td>
                                <td>${fmt(b.limitAmount)}</td>
                                <td>${fmt(spent)}</td>
                                <td>
                                    <div class="progress-wrapper">
                                        <div class="progress-bar ${status}" style="width: ${pct}%"></div>
                                        <span class="pct-text">${pct}%</span>
                                    </div>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>

        <div class="section">
            <h2>Spending by Category</h2>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Category</th>
                        <th>Amount</th>
                        <th>% of Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${topCats.map(cat => {
                        const total = topCats.reduce((s: number, c: any) => s + c.amount, 0);
                        const pct = total > 0 ? ((cat.amount / total) * 100).toFixed(1) : '0.0';
                        return `
                            <tr>
                                <td><span class="cat-dot" style="background: ${cat.color}"></span>${cat.name}</td>
                                <td>${fmt(cat.amount)}</td>
                                <td>${pct}%</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>

        <div class="section">
            <h2>Transaction History</h2>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Description</th>
                        <th>Category</th>
                        <th>Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${transactions.slice(0, 20).map(t => `
                        <tr>
                            <td>${new Date(t.date).toLocaleDateString()}</td>
                            <td>${t.payee || 'No description'}</td>
                            <td>${t.categoryName}</td>
                            <td class="${t.type === 'income' ? 'income' : 'expense'}">
                                ${t.type === 'income' ? '+' : '-'} ${fmt(t.amount)}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <div class="footer">
            Generated by <strong>MoneyKracked</strong> • Personal Finance Tracker
        </div>
        `;

        // Add print styles
        const style = document.createElement('style');
        style.id = 'print-report-styles';
        style.textContent = `
            @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700;800&display=swap');

            @media print {
                @page { margin: 0.5cm; size: A4; }
                body * { visibility: hidden; }
                #print-report-container, #print-report-container * { visibility: visible; }
                #print-report-container {
                    position: absolute;
                    left: 0;
                    top: 0;
                    width: 100%;
                    background: #0a0a0a !important;
                    color: #ffffff !important;
                    font-family: 'JetBrains Mono', monospace;
                    padding: 20px;
                    box-sizing: border-box;
                }
            }

            #print-report-container {
                display: none;
                font-family: 'JetBrains Mono', monospace;
                background: #0a0a0a;
                color: #ffffff;
                max-width: 800px;
                margin: 0 auto;
            }

            .print-header {
                text-align: center;
                padding: 20px 0;
                border-bottom: 3px solid #4ade80;
                margin-bottom: 20px;
            }

            .print-header h1 {
                font-size: 28px;
                font-weight: 800;
                color: #4ade80;
                margin: 0;
                letter-spacing: 2px;
                text-transform: uppercase;
            }

            .subtitle {
                font-size: 12px;
                color: #60a5fa;
                margin-top: 5px;
                letter-spacing: 4px;
            }

            .report-meta {
                font-size: 11px;
                color: #6b7280;
                margin-top: 10px;
                text-transform: uppercase;
            }

            .stats-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 15px;
                margin-bottom: 25px;
            }

            .stat-card {
                border: 2px solid #27272a;
                padding: 15px;
                text-align: center;
                background: #18181b;
            }

            .stat-label {
                font-size: 10px;
                color: #6b7280;
                text-transform: uppercase;
                letter-spacing: 1px;
                margin-bottom: 8px;
            }

            .stat-value {
                font-size: 18px;
                font-weight: 700;
            }

            .stat-value.primary { color: #4ade80; }
            .stat-value.warning { color: #fbbf24; }
            .stat-value.success { color: #22c55e; }
            .stat-value.danger { color: #ef4444; }

            .section {
                margin-bottom: 25px;
            }

            .section h2 {
                font-size: 14px;
                color: #60a5fa;
                border-bottom: 2px solid #27272a;
                padding-bottom: 10px;
                margin-bottom: 15px;
                text-transform: uppercase;
                letter-spacing: 2px;
            }

            .data-table {
                width: 100%;
                border-collapse: collapse;
            }

            .data-table th {
                text-align: left;
                padding: 10px;
                border-bottom: 2px solid #4ade80;
                font-size: 10px;
                color: #6b7280;
                text-transform: uppercase;
                letter-spacing: 1px;
            }

            .data-table td {
                padding: 10px;
                border-bottom: 1px solid #27272a;
                font-size: 11px;
            }

            .cat-dot {
                display: inline-block;
                width: 8px;
                height: 8px;
                border-radius: 2px;
                margin-right: 8px;
            }

            .progress-wrapper {
                display: flex;
                align-items: center;
                gap: 10px;
            }

            .progress-bar {
                height: 8px;
                border-radius: 2px;
                min-width: 60px;
            }

            .progress-bar.success { background: #22c55e; }
            .progress-bar.warning { background: #fbbf24; }
            .progress-bar.danger { background: #ef4444; }

            .pct-text {
                font-size: 10px;
                color: #6b7280;
                min-width: 35px;
            }

            .income { color: #22c55e; }
            .expense { color: #ef4444; }

            .footer {
                text-align: center;
                padding: 20px;
                margin-top: 30px;
                border-top: 2px solid #27272a;
                font-size: 10px;
                color: #6b7280;
                text-transform: uppercase;
            }
        `;

        // Store original body content
        const originalContent = document.body.innerHTML;

        // Add styles and content
        document.head.appendChild(style);
        document.body.appendChild(printContainer);
        printContainer.style.display = 'block';

        // Print and restore
        window.print();

        // Cleanup after print dialog closes
        setTimeout(() => {
            document.body.removeChild(printContainer);
            document.head.removeChild(style);
        }, 100);

    } catch (err) {
        console.error('Export PDF error:', err);
        alert('Failed to export PDF. Please try again.');
    }
  }

  function exportHTML() {
    try {
        const curr = currencies[selectedCurrency];
        const now = new Date();

        function fmt(amt: number): string {
          const conv = convertAmountMYR(amt, selectedCurrency, exchangeRates);
          return curr.symbol + ' ' + formatNumber(conv, curr.locale);
        }

        const cats = spendingByCategory;
        const topCats = cats.filter((c: any) => c.name !== 'Income' && c.name !== 'Savings').slice(0, 5);
        const maxCat = topCats[0]?.amount || 1;

        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>MoneyKracked Report - ${selectedMonthYear}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700;800&display=swap');
        :root {
            --primary: #4ade80;
            --secondary: #60a5fa;
            --warning: #fbbf24;
            --danger: #ef4444;
            --success: #22c55e;
            --bg: #0a0a0a;
            --surface: #18181b;
            --border: #27272a;
            --text: #ffffff;
            --muted: #6b7280;
        }
        body {
            background: var(--bg);
            color: var(--text);
            font-family: 'JetBrains Mono', monospace;
            margin: 0;
            padding: 40px;
        }
        .container { max-width: 800px; margin: 0 auto; border: 4px solid var(--border); padding: 40px; background: var(--surface); }
        .header { text-align: center; margin-bottom: 40px; border-bottom: 3px solid var(--primary); padding-bottom: 20px; }
        h1 { font-size: 28px; color: var(--primary); text-transform: uppercase; margin: 0; letter-spacing: 2px; }
        .subtitle { font-size: 12px; color: var(--secondary); letter-spacing: 4px; }
        .meta { font-size: 11px; color: var(--muted); margin-top: 10px; text-transform: uppercase; }
        .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 40px; }
        .stat-card { border: 2px solid var(--border); padding: 15px; text-align: center; background: var(--bg); }
        .stat-label { font-size: 10px; color: var(--muted); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; }
        .stat-value { font-size: 18px; font-weight: 700; }
        .stat-value.primary { color: var(--primary); }
        .stat-value.warning { color: var(--warning); }
        .stat-value.success { color: var(--success); }
        .stat-value.danger { color: var(--danger); }
        .section-title { font-size: 14px; color: var(--secondary); border-bottom: 2px solid var(--border); padding: 10px 0; margin: 30px 0 20px 0; text-transform: uppercase; letter-spacing: 2px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th { text-align: left; padding: 10px; border-bottom: 2px solid var(--primary); text-transform: uppercase; font-size: 10px; color: var(--muted); letter-spacing: 1px; }
        td { padding: 10px; border-bottom: 1px solid var(--border); font-size: 11px; }
        .progress-bg { height: 8px; background: var(--bg); border-radius: 2px; overflow: hidden; }
        .progress-bar { height: 100%; border-radius: 2px; }
        .footer { text-align: center; margin-top: 40px; padding: 20px; border-top: 2px solid var(--border); font-size: 10px; color: var(--muted); text-transform: uppercase; }
        .cat-dot { display: inline-block; width: 8px; height: 8px; border-radius: 2px; margin-right: 8px; }
        .income { color: var(--success); }
        .expense { color: var(--danger); }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>MoneyKracked</h1>
            <div class="subtitle">FINANCIAL REPORT</div>
            <div class="meta">${selectedMonthYear} • Generated ${now.toLocaleDateString()}</div>
        </div>

        <div class="grid">
            <div class="stat-card">
                <div class="stat-label">Total Budget</div>
                <div class="stat-value primary">${fmt(totalBudgetWithIncome)}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Total Spent</div>
                <div class="stat-value warning">${fmt(totalExpenses)}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Total Savings</div>
                <div class="stat-value success">${fmt(totalSavings)}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Remaining</div>
                <div class="stat-value ${remainingBudget >= 0 ? 'primary' : 'danger'}">${fmt(remainingBudget)}</div>
            </div>
        </div>

        <div class="section-title">Budget Performance</div>
        <table>
            <thead>
                <tr>
                    <th>Category</th>
                    <th>Budgeted</th>
                    <th>Spent</th>
                    <th>Usage</th>
                </tr>
            </thead>
            <tbody>
                ${budgets.map(b => {
                    const spent = cats.find((c: any) => c.name === b.categoryName)?.amount || 0;
                    const pct = b.limitAmount > 0 ? Math.min(Math.round((spent / b.limitAmount) * 100), 100) : 0;
                    const status = pct >= 100 ? 'var(--danger)' : pct >= 80 ? 'var(--warning)' : 'var(--success)';
                    return `
                        <tr>
                            <td><span class="cat-dot" style="background: ${b.categoryColor}"></span>${b.categoryName}</td>
                            <td>${fmt(b.limitAmount)}</td>
                            <td>${fmt(spent)}</td>
                            <td>
                                <div class="progress-bg"><div class="progress-bar" style="width: ${pct}%; background: ${status}"></div></div>
                            </td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>

        <div class="section-title">Top Spending Categories</div>
        <table>
            <thead>
                <tr>
                    <th>Category</th>
                    <th>Amount</th>
                </tr>
            </thead>
            <tbody>
                ${topCats.map(cat => `
                    <tr>
                        <td><span class="cat-dot" style="background: ${cat.color}"></span>${cat.name}</td>
                        <td>${fmt(cat.amount)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <div class="section-title">Recent Transactions</div>
        <table>
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Category</th>
                    <th>Amount</th>
                </tr>
            </thead>
            <tbody>
                ${transactions.slice(0, 15).map(t => `
                    <tr>
                        <td>${new Date(t.date).toLocaleDateString()}</td>
                        <td>${t.payee || 'No description'}</td>
                        <td>${t.categoryName}</td>
                        <td class="${t.type === 'income' ? 'income' : 'expense'}">
                            ${t.type === 'income' ? '+' : '-'} ${fmt(t.amount)}
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <div class="footer">
            Generated by MoneyKracked • Personal Finance Tracker
        </div>
    </div>
</body>
</html>
        `;

        const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `MoneyKracked_Report_${months[selectedMonth]}_${selectedYear}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (err) {
        console.error('Export HTML error:', err);
        alert('Failed to export Report. Please try again.');
    }
  }
</script>

<svelte:head>
  <title>Reports - MoneyKracked</title>
</svelte:head>

<!-- Currency reactive trigger - forces re-render when currency changes -->
{#if currencyUpdateCounter >= 0}<!-- {currencyUpdateCounter} -->{/if}

<!-- Page Header with Month Selector -->
<div class="flex flex-col h-full w-full overflow-hidden bg-[var(--color-bg)]">
  <!-- Main Reports Column -->
  <div class="flex-1 flex flex-col min-w-0 h-full relative bg-[var(--color-bg)]">
    <!-- App-like Inline Header -->
    <header class="h-20 flex items-center justify-between px-6 lg:px-10 border-b-4 border-black bg-[var(--color-surface-raised)] flex-shrink-0 z-20 shadow-lg">
      <div class="flex items-center gap-4">
            <button class="lg:hidden mr-2 p-2 -ml-2 text-[var(--color-text)] hover:bg-[var(--color-surface)] rounded-none transition-colors" onclick={toggleSidebar}>
              <span class="material-symbols-outlined">menu</span>
            </button>
        <div class="flex flex-col flex-1 min-w-0">
          <h2 class="text-base md:text-xl font-display text-[var(--color-primary)] truncate">FINANCIAL <span class="text-[var(--color-text)]">REPORTS</span></h2>
          <p class="text-[9px] md:text-[10px] font-mono text-[var(--color-text-muted)] flex items-center gap-2 uppercase">
            <span class="flex h-2 w-2 rounded-full bg-[var(--color-primary)] animate-pulse"></span>
            {selectedMonthYear}
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

        <div class="flex gap-2">
            <PixelButton variant="primary" onclick={exportReport} class="h-10 px-2 sm:px-4">
                <span class="material-symbols-outlined text-sm">picture_as_pdf</span>
                <span class="hidden sm:inline ml-1 text-[10px]">PDF</span>
            </PixelButton>

            <PixelButton variant="secondary" onclick={exportCSV} class="h-10 px-2 sm:px-4">
                <span class="material-symbols-outlined text-sm">download</span>
                <span class="hidden sm:inline ml-1 text-[10px]">CSV</span>
            </PixelButton>
        </div>
      </div>
    </header>

    <!-- Scrollable Content Area -->
    <div class="flex-1 overflow-y-auto p-6 lg:p-10 space-y-8 scroll-smooth custom-scrollbar">

{#if loading}
    <div class="flex flex-col items-center justify-center py-20">
      <div class="inline-block animate-spin h-12 w-12 border-4 border-[var(--color-primary)] border-t-transparent mb-4"></div>
      <p class="text-[var(--color-text-muted)] font-mono uppercase">Generating Report...</p>
    </div>
{:else}
    <!-- Summary Cards -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <IsometricCard class="bg-[var(--color-surface)] text-center">
            <p class="text-xs font-mono text-[var(--color-text-muted)] tracking-widest uppercase">Total Available</p>
            <h3 class="mt-2 text-xl font-bold font-mono text-[var(--color-text)]">{formatAmount(totalBudgetWithIncome)}</h3>
            <p class="text-[10px] text-[var(--color-text-muted)] mt-1 font-mono uppercase">Budget + Income</p>
        </IsometricCard>
        
        <IsometricCard class="bg-[var(--color-surface)] text-center">
            <p class="text-xs font-mono text-[var(--color-text-muted)] tracking-widest uppercase">Total Spent</p>
            <h3 class="mt-2 text-xl font-bold font-mono text-[var(--color-warning)]">{formatAmount(totalExpenses)}</h3>
            <p class="text-[10px] text-[var(--color-text-muted)] mt-1 font-mono uppercase">All Expenses</p>
        </IsometricCard>

        <IsometricCard class="bg-[var(--color-surface)] text-center">
            <p class="text-xs font-mono text-[var(--color-text-muted)] tracking-widest uppercase">Total Savings</p>
            <h3 class="mt-2 text-xl font-bold font-mono text-[var(--color-success)]">{formatAmount(totalSavings)}</h3>
            <p class="text-[10px] text-[var(--color-text-muted)] mt-1 font-mono uppercase">Remaining + Savings</p>
        </IsometricCard>
        
        <IsometricCard class="bg-[var(--color-surface)] text-center">
            <p class="text-xs font-mono text-[var(--color-text-muted)] tracking-widest uppercase">Remaining</p>
            <h3 class="mt-2 text-xl font-bold font-mono {remainingBudget >= 0 ? 'text-[var(--color-primary)]' : 'text-[var(--color-danger)]'}">
                {formatAmount(remainingBudget)}
            </h3>
            <p class="text-[10px] text-[var(--color-text-muted)] mt-1 font-mono uppercase">Budget Left</p>
        </IsometricCard>
    </div>

    <!-- Trend Chart -->
    <IsometricCard title="Savings vs Expenses" class="mb-6">
        <div class="h-64 flex items-end gap-8 px-8 pt-8 pb-4 relative">
             <!-- Grid Lines -->
             <div class="absolute inset-0 flex flex-col justify-between pointer-events-none px-8 py-8 opacity-10">
                <div class="border-b border-[var(--color-text)] w-full"></div>
                <div class="border-b border-[var(--color-text)] w-full"></div>
                <div class="border-b border-[var(--color-text)] w-full"></div>
                <div class="border-b border-[var(--color-text)] w-full"></div>
             </div>

             {#each monthlyData as data}
                <div class="flex-1 flex flex-col items-center gap-2 group relative">
                    <div class="flex gap-2 w-full justify-center items-end h-40">
                        <!-- Savings Bar -->
                        <div 
                            class="w-12 bg-[var(--color-success)] border-2 border-black shadow-[2px_2px_0px_0px_var(--color-shadow)] transition-all hover:scale-x-110 relative"
                            style="height: {getBarHeight(data.savings)}%"
                        >
                            <div class="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white text-[10px] px-1 font-mono whitespace-nowrap z-20">
                                S: {formatAmount(data.savings)}
                            </div>
                        </div>
                        <!-- Expenses Bar -->
                        <div 
                            class="w-12 bg-[var(--color-danger)] border-2 border-black shadow-[2px_2px_0px_0px_var(--color-shadow)] transition-all hover:scale-x-110 relative"
                            style="height: {getBarHeight(data.expenses)}%"
                        >
                            <div class="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white text-[10px] px-1 font-mono whitespace-nowrap z-20">
                                E: {formatAmount(data.expenses)}
                            </div>
                        </div>
                    </div>
                    <span class="text-xs font-mono font-bold text-[var(--color-text)] uppercase">{data.month}</span>
                </div>
             {/each}
        </div>
        <div class="flex justify-center gap-6 mt-2 pb-2">
            <div class="flex items-center gap-2">
                <div class="w-3 h-3 bg-[var(--color-success)] border border-black"></div>
                <span class="text-[10px] font-mono uppercase text-[var(--color-text-muted)]">Savings</span>
            </div>
            <div class="flex items-center gap-2">
                <div class="w-3 h-3 bg-[var(--color-danger)] border border-black"></div>
                <span class="text-[10px] font-mono uppercase text-[var(--color-text-muted)]">Expenses</span>
            </div>
        </div>
    </IsometricCard>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Budget vs Spent -->
        <IsometricCard title="Budget Performance">
            {#if budgets.length > 0}
                <div class="space-y-4">
                     <div class="grid grid-cols-12 text-xs font-bold text-[var(--color-text-muted)] font-mono uppercase pb-2 border-b-2 border-[var(--color-border)]">
                        <div class="col-span-5">Category</div>
                        <div class="col-span-3 text-right">Spent</div>
                        <div class="col-span-4 pl-2">Progress</div>
                     </div>
                     {#each budgets as budget}
                        {@const spentData = spendingByCategory.find(c => c.name === budget.categoryName)}
                        {@const spent = spentData ? spentData.amount : 0}
                        {@const pct = budget.limitAmount > 0 ? (spent / budget.limitAmount) * 100 : 0}
                        {@const status = pct >= 100 ? 'danger' : pct >= 80 ? 'warning' : 'safe'}
                        
                        <div class="grid grid-cols-12 items-center py-2 border-b border-[var(--color-surface-raised)] last:border-0 hover:bg-[var(--color-surface-raised)]">
                            <div class="col-span-5 font-bold text-[var(--color-text)] text-sm truncate pr-2">{budget.categoryName}</div>
                            <div class="col-span-3 font-mono text-[var(--color-text-muted)] text-xs text-right">
                                {formatAmount(spent)}
                            </div>
                            <div class="col-span-4 pl-2">
                                <div class="h-2 bg-[var(--color-bg)] border border-[var(--color-border)] relative">
                                    <div class="h-full absolute top-0 left-0" style="width: {Math.min(pct, 100)}%; background-color: {status === 'danger' ? 'var(--color-danger)' : status === 'warning' ? 'var(--color-warning)' : budget.categoryColor}"></div>
                                </div>
                            </div>
                        </div>
                     {/each}
                </div>
            {:else}
                 <p class="text-[var(--color-text-muted)] text-center py-8 font-mono">No budgets set</p>
            {/if}
        </IsometricCard>

        <!-- Top Spending -->
        <IsometricCard title="Top Spending">
           {@const cats = spendingByCategory.filter(c => c.name !== 'Income' && c.name !== 'Savings').slice(0, 5)}
           {#if cats.length > 0}
             {@const maxVal = cats[0].amount}
             <div class="space-y-3">
                {#each cats as cat}
                    <div class="flex items-center gap-3">
                        <div class="flex-1">
                             <div class="flex justify-between text-xs font-bold font-mono mb-1">
                                <span class="text-[var(--color-text)]">{cat.name}</span>
                                <span class="text-[var(--color-text-muted)]">{formatAmount(cat.amount)}</span>
                             </div>
                             <div class="h-4 bg-[var(--color-bg)] border-2 border-[var(--color-border)] relative">
                                <div class="h-full bg-[var(--color-primary)] absolute top-0 left-0" style="width: {(cat.amount / maxVal) * 100}%"></div>
                             </div>
                        </div>
                    </div>
                {/each}
             </div>
           {:else}
              <p class="text-[var(--color-text-muted)] text-center py-8 font-mono">No expenses recorded</p>
           {/if}
        </IsometricCard>
  </div>
{/if}
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
