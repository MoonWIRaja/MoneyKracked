import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { exchangeRates } from '$lib/server/db/schema';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, cookies }) => {
  // If not authenticated, redirect to login
  if (!locals.user) {
    throw redirect(303, '/login');
  }

  // PERFORMANCE: Preload exchange rates
  // This makes them available immediately to all child pages without additional API calls
  const ratesData = await db.query.exchangeRates.findMany();

  // Get preferences from cookie (not database)
  let currency = 'MYR';
  let theme = 'dark';
  try {
    const prefsCookie = cookies.get('user-preferences');
    if (prefsCookie) {
      const prefs = JSON.parse(prefsCookie);
      currency = prefs.currency || 'MYR';
      theme = prefs.theme || 'dark';
    }
  } catch { }

  // Build exchange rates map for client
  const ratesMap: Record<string, Record<string, number>> = {};
  for (const rate of ratesData) {
    if (!ratesMap[rate.fromCurrency]) {
      ratesMap[rate.fromCurrency] = {};
    }
    ratesMap[rate.fromCurrency][rate.toCurrency] = parseFloat(rate.rate as string);
  }

  return {
    user: locals.user,
    session: locals.session,
    // Preloaded data for instant page loads
    rates: ratesMap,
    currency,
    theme
  };
};
