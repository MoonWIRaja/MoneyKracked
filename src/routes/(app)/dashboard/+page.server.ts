import { db } from '$lib/server/db';
import { exchangeRates, budgets, transactions } from '$lib/server/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

/**
 * Preload ALL dashboard data on server for instant display
 * This eliminates client-side fetching time
 */
export const load: PageServerLoad = async ({ locals, cookies }) => {
	// Get current month/year for dashboard
	const now = new Date();
	const month = now.getMonth() + 1;
	const year = now.getFullYear();

	// Start and end of current month (as ISO strings for database comparison)
	const startDateStr = new Date(year, month - 1, 1).toISOString();
	const endDateStr = new Date(year, month, 0, 23, 59, 59).toISOString();

	// Get currency from cookie (not database)
	let currency = 'MYR';
	try {
		const prefsCookie = cookies.get('user-preferences');
		if (prefsCookie) {
			const prefs = JSON.parse(prefsCookie);
			currency = prefs.currency || 'MYR';
		}
	} catch { }

	// Run all queries in parallel for maximum speed
	const [ratesData, budgetData, txData] = await Promise.all([
		// Exchange rates
		db.query.exchangeRates.findMany(),

		// Budgets - get all and filter by date in JS (simpler, more reliable)
		db.query.budgets.findMany({
			where: eq(budgets.userId, locals.user?.id || ''),
			with: {
				category: true
			}
		}),

		// Transactions for current month
		db.query.transactions.findMany({
			where: and(
				eq(transactions.userId, locals.user?.id || ''),
				gte(transactions.date, new Date(startDateStr)),
				lte(transactions.date, new Date(endDateStr))
			),
			orderBy: (transactions, { desc }) => [desc(transactions.date)],
			limit: 100,
			with: {
				category: true
			}
		})
	]);

	// Filter budgets by date range (budget overlaps with current month)
	const startDate = new Date(startDateStr);
	const endDate = new Date(endDateStr);
	const filteredBudgets = budgetData.filter((b) => {
		const budgetStart = b.startDate ? new Date(b.startDate) : null;
		const budgetEnd = b.endDate ? new Date(b.endDate) : null;
		// Budget overlaps if: budget.start <= month.end AND budget.end >= month.start
		return (!budgetStart || budgetStart <= endDate) && (!budgetEnd || budgetEnd >= startDate);
	});

	// Build exchange rates map
	const ratesMap: Record<string, Record<string, number>> = {};
	for (const rate of ratesData) {
		if (!ratesMap[rate.fromCurrency]) {
			ratesMap[rate.fromCurrency] = {};
		}
		ratesMap[rate.fromCurrency][rate.toCurrency] = parseFloat(rate.rate as string);
	}

	// Format budgets for client
	const formattedBudgets = filteredBudgets.map((b) => ({
		id: b.id,
		categoryName: b.category?.name || 'Unknown',
		categoryIcon: b.category?.icon || 'category',
		categoryColor: b.category?.color || '#6b7280',
		limitAmount: parseFloat(b.limitAmount as string),
		spent: 0 // Will be calculated on client
	}));

	// Format transactions for client
	const formattedTransactions = txData.map((t) => ({
		id: t.id,
		payee: t.payee || 'No description',
		amount: parseFloat(t.amount as string),
		type: t.type,
		date: t.date instanceof Date ? t.date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
		categoryName: t.category?.name || 'Other',
		categoryIcon: t.category?.icon || 'category',
		categoryColor: t.category?.color || '#6b7280'
	}));

	return {
		rates: ratesMap,
		currency,
		month,
		year,
		budgets: formattedBudgets,
		transactions: formattedTransactions
	};
};
