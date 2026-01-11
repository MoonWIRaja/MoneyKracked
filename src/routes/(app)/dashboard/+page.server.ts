import { db } from '$lib/server/db';
import { budgets, transactions } from '$lib/server/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

/**
 * Preload dashboard data on server for instant display
 * Exchange rates come from layout load (cached)
 */
export const load: PageServerLoad = async ({ locals, cookies, url }) => {
	// Check for auth_token in URL (from OAuth callback)
	const authToken = url.searchParams.get('auth_token');
	if (authToken) {
		console.log('[Dashboard] Found auth_token in URL, setting cookie...');
		// Set the cookie server-side
		cookies.set('better-auth.session_token', authToken, {
			path: '/',
			httpOnly: true,
			sameSite: 'none', // Try 'none' for cross-origin
			secure: true, // Use true for HTTPS
			maxAge: 60 * 60 * 24 * 7 // 7 days
		});
		console.log('[Dashboard] Cookie set, redirecting to dashboard without token...');

		// Redirect to dashboard without the token in URL
		throw redirect(302, '/dashboard');
	}
	// Get current month/year for dashboard
	const now = new Date();
	const month = now.getMonth() + 1;
	const year = now.getFullYear();

	// Start and end of current month
	const startDateStr = new Date(year, month - 1, 1).toISOString();
	const endDateStr = new Date(year, month, 0, 23, 59, 59).toISOString();

	// Get currency from cookie (fast)
	let currency = 'MYR';
	try {
		const prefsCookie = cookies.get('user-preferences');
		if (prefsCookie) {
			const prefs = JSON.parse(prefsCookie);
			currency = prefs.currency || 'MYR';
		}
	} catch { }

	// Run queries in parallel for maximum speed
	const [budgetData, txData] = await Promise.all([
		// Budgets
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

	// Filter budgets by date range
	const startDate = new Date(startDateStr);
	const endDate = new Date(endDateStr);
	const filteredBudgets = budgetData.filter((b) => {
		const budgetStart = b.startDate ? new Date(b.startDate) : null;
		const budgetEnd = b.endDate ? new Date(b.endDate) : null;
		return (!budgetStart || budgetStart <= endDate) && (!budgetEnd || budgetEnd >= startDate);
	});

	// Format budgets for client
	const formattedBudgets = filteredBudgets.map((b) => ({
		id: b.id,
		categoryName: b.category?.name || 'Unknown',
		categoryIcon: b.category?.icon || 'category',
		categoryColor: b.category?.color || '#6b7280',
		limitAmount: parseFloat(b.limitAmount as string),
		spent: 0 // Calculated on client
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
		currency,
		month,
		year,
		budgets: formattedBudgets,
		transactions: formattedTransactions
	};
};
